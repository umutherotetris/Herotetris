"""Smoke-test the enlarged ivory/obsidian Ottoman atlas on a phone viewport."""
import os
from pathlib import Path
import re
from playwright.sync_api import expect, sync_playwright

url=os.getenv("HERO_PREVIEW_URL","http://127.0.0.1:8826").rstrip("/")
out=Path(os.getenv("HERO_PREVIEW_ARTIFACTS","/tmp"))
out.mkdir(parents=True,exist_ok=True)
opts={"headless":True,"args":["--no-sandbox"]}
if os.getenv("HERO_CHROMIUM"): opts["executable_path"]=os.environ["HERO_CHROMIUM"]
if os.getenv("HERO_BROWSER_PROXY"): opts["proxy"]={"server":os.environ["HERO_BROWSER_PROXY"],"bypass":"localhost,127.0.0.1"}

with sync_playwright() as pw:
    browser=pw.chromium.launch(**opts)
    for width in map(int,os.getenv("HERO_WIDTHS","360,390,430").split(",")):
        context=browser.new_context(viewport={"width":width,"height":844},device_scale_factor=3,
                                    is_mobile=True,has_touch=True,service_workers="block",
                                    ignore_https_errors=bool(os.getenv("HERO_BROWSER_PROXY")))
        page=context.new_page()
        def request(route):
            src=route.request.url
            sdk=re.fullmatch(r"https://www\.gstatic\.com/firebasejs/10\.12\.0/(firebase-[a-z]+\.js)",src)
            if sdk and os.getenv("HERO_FIREBASE_SDK_DIR"):
                route.fulfill(status=200,content_type="text/javascript",headers={"access-control-allow-origin":"*"},
                              path=str(Path(os.environ["HERO_FIREBASE_SDK_DIR"])/sdk[1]))
            elif sdk or src.startswith(url+"/"): route.continue_()
            else: route.abort()
        page.route("**/*",request)
        page.add_init_script("""window.ottomanFrames = [];
        const orig = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(source,...args) {
          if(this.canvas.dataset.el === 'canvas' && source.src?.includes('ottoman-figures-v162.webp')) {
            if(ottomanFrames.length >= 250) ottomanFrames.shift();
            ottomanFrames.push(args);
          }
          return orig.call(this,source,...args);
        };""")
        page.goto(url+"/index.html",wait_until="domcontentloaded")
        page.wait_for_function("typeof window.Hero?.openChess === 'function'")
        page.locator("#gameChess").click()
        root=page.locator(".chess-root")
        root.locator('[data-mode="local"]').click()
        root.locator('[data-group="flip"] [data-v="0"]').click()
        root.locator(".cas-start").click()
        board=root.locator('canvas[data-el="canvas"]')
        root.locator('[data-studio-section="piece"]').click()
        expect(root.locator('[data-ctp-piece="ottomanMesh"]')).to_be_visible()
        root.locator('[data-ctp-piece="ottoman3d"]').click()
        root.locator(".ctp-close").click()
        expect(root.locator('[data-studio-piece-name]')).to_have_text("Osmanlı 3B")
        page.wait_for_function("ottomanFrames.length >= 32")
        data=page.evaluate("ottomanFrames.slice(-32)")
        bounds=board.bounding_box()
        size=round(bounds["width"])
        cell=(size-2*int(size*.055+.5))//8
        inset=(size-8*cell)/2
        centers=set()
        for sx,sy,sw,sh,x,y,w,h in data:
            col=round((x+w/2-inset)/cell-.5)
            row=round((y+h-inset)/cell-.982)
            assert inset+col*cell <= x < x+w <= inset+(col+1)*cell
            assert inset+row*cell <= y < y+h <= inset+(row+1)*cell
            assert abs(w/h-sw/sh)<1e-5
            assert .885 <= h/cell <= .971
            centers.add((col,row))
        assert centers=={(c,r) for c in range(8) for r in (0,1,6,7)}
        if width==390: page.screenshot(path=str(out/"Hero-Osmanli-3B-Buyuk-Mobil.png"))
        for r in (6,4):
            page.touchscreen.tap(bounds["x"]+inset+4.5*cell,bounds["y"]+inset+(r+.5)*cell)
        expect(root.locator('[data-el="turn"]')).to_contain_text("SİYAH")
        print(f"{width}px: 32 original figures contained in squares; touch move passed",flush=True)
        context.close()
