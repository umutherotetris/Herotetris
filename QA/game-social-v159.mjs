import assert from 'node:assert/strict';
import {gameSocialBounds} from '../js/game-social.js';

// Actual CSS positions use visual viewport pixels and can be translated
// when the browser moves the viewport to reveal a mobile keyboard.
const portrait={left:0,top:0,width:390,height:750};
const keyboard={left:24,top:219,width:320,height:292};
const landscape={left:0,top:0,width:844,height:325};
const desktop={left:0,top:0,width:1280,height:800};
for(const view of [portrait,keyboard,landscape,desktop]){
  for(const zoom of [.8,1,1.3]){
    const {left,top,width,height}=gameSocialBounds(view,zoom);
    assert.ok(width>0&&height>0);
    assert.ok(left>=view.left+8&&left+width<=view.left+view.width-8);
    assert.ok(top>=view.top+8&&top+height<=view.top+view.height-8);
    if(view===desktop)assert.equal(left+width,1272,'wide layout docks on the right');
    if(view===portrait){
      assert.equal(top+height,742,'portrait layout opens at the bottom');
      assert.ok(top>200,'part of the game remains visible');
    }
    if(view===keyboard)assert.ok(height / zoom >= 210,'composer keeps a useful short-viewport sheet');
  }
}
console.log('PASS game social v159: mobile keyboard, portrait, landscape and desktop placement across saved scales');
