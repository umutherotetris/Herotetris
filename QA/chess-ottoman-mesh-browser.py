"""Private Hero 3D browser regression. python -m http.server 8819 at repository root."""
import os
from pathlib import Path
import re
from playwright.sync_api import expect, sync_playwright

URL = os.getenv("HERO_PREVIEW_URL", "http://127.0.0.1:8819").rstrip("/")
OUT = Path(os.getenv("HERO_PREVIEW_ARTIFACTS", "/tmp"))
OUT.mkdir(parents=True, exist_ok=True)

OBSERVE = """
(disableGL) => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
        if (disableGL && kind === 'webgl2') return null;
        return context.call(this, kind, ...args);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    window.heroBoardFrames = [];
    CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
        const mesh = source instanceof HTMLCanvasElement && source.width === 160 && source.height === 160;
        if (this.canvas.dataset.el === 'canvas' &&
            (mesh || source.src?.includes('chess-ottoman-3d'))) {
            window.heroBoardFrames.push({mesh, args});
            if (window.heroBoardFrames.length > 4096) window.heroBoardFrames.shift();
        }
        return draw.call(this, source, ...args);
    };
}
"""

def open_game(page):
    page.goto(URL + "/index.html", wait_until="domcontentloaded")
    page.wait_for_function("typeof window.Hero?.openChess === 'function'",timeout=20000)
    page.locator("#gameChess").click(timeout=20000)
    page.locator('.chess-root [data-mode="local"]').click()
    page.locator('.chess-root [data-group="flip"] [data-v="0"]').click()
    page.locator('.chess-root .cas-start').click()
    board = page.locator('.chess-root canvas[data-el="canvas"]')
    expect(board).to_be_visible()
    page.locator('.chess-root [data-studio-section="piece"]').click()
    page.locator('.chess-root [data-ctp-piece="ottomanMesh"]').click()
    expect(page.locator('.chess-root [data-ctp-piece="ottomanMesh"]')).to_have_attribute("aria-pressed", "true")
    page.locator('.chess-root .ctp-close').click()
    expect(page.locator('.chess-root [data-studio-piece-name]')).to_have_text("Osmanlı Renkli 3B")
    return board

def assert_fen_after_move(page, board):
    bounds = board.bounding_box()
    n = round(bounds["width"])
    edge= int(n * .055 + .5)
    cell = (n - 2 * edge) // 8
    inset = (n - 8 * cell) / 2
    assert 200 < n <= 390 and bounds['x'] >= 0 and bounds['x']+bounds['width'] <= 391
    assert bounds['y'] + bounds['height'] <= 845
    for r in (6,4): # e2 -> e4
        page.touchscreen.tap(bounds["x"] + inset + cell*4.5, bounds["y"] + inset + cell*(r+.5))
    expect(page.locator('.chess-root [data-el="turn"]')).to_contain_text("SİYAH")
    page.locator('.chess-root [data-act="history"]').click()
    expect(page.locator('.chess-root [data-el="historyList"]')).to_contain_text("e4")
    page.locator('.chess-root [data-act="historyClose"]').click()
    assert page.evaluate("localStorage.getItem('hero_chess_piece_style')") == "ottomanMesh"

with sync_playwright() as p:
    opts = dict(headless=True, args=["--no-sandbox","--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    if os.getenv("HERO_CHROMIUM"): opts["executable_path"] = os.environ["HERO_CHROMIUM"]
    if os.getenv("HERO_BROWSER_PROXY"): opts["proxy"] = {"server":os.environ["HERO_BROWSER_PROXY"],"bypass":"localhost,127.0.0.1"}
    browser = p.chromium.launch(**opts)
    for case in os.getenv("HERO_TEST_CASES","mesh,no-webgl,no-king,no-model").split(","):
        context = browser.new_context(viewport={"width":390,"height":844},device_scale_factor=3,is_mobile=True,has_touch=True,service_workers="block")
        page = context.new_page()
        failures=[]; pulls=[]
        page.on("pageerror",lambda e:failures.append(str(e)))
        page.add_init_script("(" + OBSERVE + ")(" + str(case == "no-webgl").lower() + ")")
        def request(route):
            url=route.request.url
            sdk = re.fullmatch(r"https://www\.gstatic\.com/firebasejs/10\.12\.0/(firebase-[a-z]+\.js)",url)
            if sdk:
                cache = os.getenv("HERO_FIREBASE_SDK_DIR")
                if cache:
                    route.fulfill(status=200,content_type="text/javascript",headers={"access-control-allow-origin":"*"},path=str(Path(cache)/sdk[1]))
                else:
                    route.continue_()
            elif not url.startswith(URL+"/"):
                route.abort()
            elif re.search(r"ottoman-[rnbqkp]\.glb$",url):
                pulls.append(url)
                if case=="no-model" or (case=="no-king" and url.endswith("ottoman-k.glb")): route.fulfill(status=404,body="Model unavailable")
                else: route.continue_()
            else: route.continue_()
        page.route("**/*",request)
        board = open_game(page)
        if case in ("mesh","no-king"):
            all32=case=="mesh"
            page.wait_for_function("() => heroBoardFrames.slice(-32).filter(x=>x.mesh).length === "+str(32 if all32 else 30),timeout=20000)
            assert len(set(pulls))==6
            frames=page.evaluate("heroBoardFrames.slice(-32)")
            bounds=board.bounding_box()
            size=round(bounds["width"]); cell=(size-2*int(size*.055+.5))//8; inset=(size-8*cell)/2
            centers=set()
            for row in frames:
                if not row["mesh"]:
                    assert row["args"][0]==576
                    continue
                x,y,w,h=row["args"]; centers.add((round(x+w/2,2),round(y+h*.53,2)))
                assert inset <= x and x+w <= size-inset and 0 <= y and y+h <= size
                assert w<=cell and h<=cell
            options={(round(inset+(col+.5)*cell,2),round(inset+(rank+.5)*cell,2))
                for col in range(8) for rank in (0,1,6,7) if all32 or (col,rank) not in ((4,0),(4,7))}
            assert centers==options,(centers-options,options-centers)
            if all32:page.screenshot(path=str(OUT/"Hero-3B-Canli-Mobil.png"))
        else:
            page.wait_for_function("heroBoardFrames.filter(x=>!x.mesh && x.args[0]===576).length >= 2",timeout=10000)
            assert page.evaluate("heroBoardFrames.every(x=>!x.mesh)")
            assert len(set(pulls))==(6 if case=="no-model" else 0)
        assert_fen_after_move(page,board)
        assert not failures,failures
        print(f"{case}: passed",flush=True)
        context.close()
    browser.close()
