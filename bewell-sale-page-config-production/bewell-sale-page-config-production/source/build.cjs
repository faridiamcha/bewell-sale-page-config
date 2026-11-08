const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = __dirname;
const source = name => fs.readFileSync(path.join(base, 'templates', name+'.txt'), 'utf8').trim().replace(/\r\n/g,'\n');
const html = source('page');
const css = source('style').replace(/<\/style>$/, () => {
  const overrides = ['campaign.css','heading-font.css'].map(file => fs.readFileSync(path.join(base,file),'utf8'));
  return overrides.join('\n')+'\n</style>';
});
let script = source('script').replace(/^<script>\s*|\s*<\/script>$/g, '');
function replace(before, after) {
  assert(script.includes(before), 'Missing template text: ' + before.slice(0, 90));
  script = script.replace(before, () => after);
}
const originalConfig = script.match(/  const CONFIG = \{[\s\S]*?\n  \};/);
assert(originalConfig);
script = script.replace(originalConfig[0], '  const CONFIG = /* CAMPAIGN_CONFIG */ {};');
replace(`      if (!form || String(form.querySelector('[name="product"]')?.value)!==String(def.id)) throw new Error('Product ID กับ URL ไม่ตรงกัน: '+def.name);`, `      const id = form?.querySelector('[name="product"]')?.value;
      if (!/^\\d+$/.test(id || '')) throw new Error('ไม่พบรหัสสินค้าจากหน้าสินค้า: '+def.path);
      def = {...def, id, name: def.name || doc.querySelector('.page-title .base, h1')?.textContent.trim() || 'สินค้า'};`);
replace('state.main=p;const target=', `state.main=p;
      renderProductDetails(p);
      CONFIG.main.variants = p.config ? Object.values(p.config.index).map(attributes => ({
        attributes,
        label: p.attributes.map(attribute => attribute.options.find(option => String(option.id) === String(attributes[attribute.id]))?.label).filter(Boolean).join(' / ')
      })) : [{attributes:{}, label:'ตัวเลือกมาตรฐาน'}];
      if (!p.config) root.querySelector('.bw-fieldset').hidden = true;
      if (p.defaultImage && !p.gallery.length) p.gallery = [{img:p.defaultImage}];
      if (p.defaultImage && !CONFIG.main.image) setImage($('#bw-main-image'), p.defaultImage, CONFIG.main.name);
      const target=`);
replace('      CONFIG.main.variants.forEach((v,index)=>{', `      if (p.attributes.length > 1) buildAttributeSelectors(p,target);
      else CONFIG.main.variants.forEach((v,index)=>{`);
replace('      const radio=$(\'[name="bw-variant"]:checked\');', `      if (state.main?.attributes.length > 1) return state.mainChoice || null;
      const radio=$('[name="bw-variant"]:checked');`);
replace(`      const selected=mainSelection();const preset=CONFIG.main.variants[Number($('[name="bw-variant"]:checked')?.value)];
      if(selected) setImage($('#bw-main-image'),selected.image||preset.image,'Bewell ENLIGHT '+preset.label);`, `      const selected=mainSelection();
      if(selected) setImage($('#bw-main-image'),selected.image || CONFIG.main.image,CONFIG.main.name);`);
replace('selected?money(selected.price):\'ไม่พร้อมจำหน่าย\'', `selected?money(displayPrices(selected).sale):'ไม่พร้อมจำหน่าย'`);
replace("'Bewell ENLIGHT รูป '+(galleryIndex+1)", "CONFIG.main.name+' รูป '+(galleryIndex+1)");
replace("      $('#bw-price').textContent=selected?money(selected.price):'กรุณาเลือกแบบ';\n      $('#bw-old-price').hidden=!(selected && selected.old>selected.price);\n      $('#bw-old-price').textContent=selected?money(selected.old):'';\n      $('#bw-sticky-price').textContent=selected?money(selected.price):'เลือกแบบ';", `      const {sale,list} = displayPrices(selected);
      $('#bw-price').textContent=Number.isFinite(sale)?money(sale):'กรุณาเลือกแบบ';
      $('#bw-old-price').hidden=!(list>sale);
      $('#bw-old-price').textContent=Number.isFinite(list)?money(list):'';
      $('#bw-sticky-price').textContent=Number.isFinite(sale)?money(sale):'เลือกแบบ';`);
replace('Number.isFinite(c.fixedDiscountPerMainUnit) && c.fixedDiscountPerMainUnit>0','Number.isFinite(c.afterPrice)');
replace('const eligible=active&&selected&&qty&&selected.price*qty>=c.minMainSubtotal;', `const useVariantPrice = state.main?.config && !CONFIG.pricing.overrideVariants;
      const afterPrice = useVariantPrice && Number.isFinite(c.discountPerUnit) && Number.isFinite(sale)
        ? Math.max(0, sale - c.discountPerUnit) : c.afterPrice;
      const eligible = active && Boolean(selected);`);
replace('money(Math.max(0,selected.price-c.fixedDiscountPerMainUnit))','money(afterPrice)');
replace("draft&&!c.verified?'ยังใช้โค้ดนี้ซื้อจริงไม่ได้ • ตะกร้าใช้ราคา Magento จริง':'ต่อ 1 ชิ้น • ตรวจสิทธิ์และยอดสุทธิในตะกร้า'", "draft&&!c.verified?'ราคาตัวอย่าง • ตรวจราคาและสิทธิ์จริงในตะกร้า':'ราคาที่ประกาศต่อชิ้น • ตรวจสิทธิ์และยอดสุทธิในตะกร้า'");
replace("draft&&!CONFIG.coupon.verified?'ราคาหลังโค้ดและของแถมเป็นตัวอย่าง • ปุ่มซื้อเพิ่มสินค้าจริงด้วยราคา Magento โดยยังไม่ลด ENLIGHT1000':'ราคาที่อ่านจากหน้าสินค้า Magento • ตรวจสิทธิ์และยอดสุทธิในตะกร้า'", "'ราคาบนหน้าเป็นราคาที่ตั้งไว้สำหรับแคมเปญ • ระบบใช้ราคาสินค้าและกฎจริงในตะกร้า Magento'");
replace('const p=await product(def);const controls=[];', 'const p=await product(def);title.textContent=p.def.name;img.alt=p.def.name;const controls=[];');
replace('setImage(img,selected?.image||p.defaultImage,def.name);','setImage(img,selected?.image||p.defaultImage,p.def.name);');
replace("let text=draft&&!gifts.verified?'รูปสินค้าจริง • การแสดงนี้ยังไม่เพิ่มของแถมในตะกร้า'", "let text=draft&&!gifts.verified?'ตัวอย่างการแสดงของแถม'");
// Radios are outside the form in V2, so freeze them explicitly during writes.
replace('#bw-main-form input,.bw-card-fields select,.bw-check input','#bw-main-form input,[name="bw-variant"],.bw-main-attribute select,.bw-card-fields select,.bw-check input');
replace('      renderGifts(total);', `      const qtyLocked = state.busy || state.locked;
      $('#bw-qty-minus').disabled = qtyLocked || qty === 1;
      $('#bw-qty-plus').disabled = qtyLocked || qty === CONFIG.maxQty;
      renderGifts(total);`);
replace('    function readQty()', `    function displayPrices(selected) {
      const useCatalog = state.main?.config && !CONFIG.pricing.overrideVariants;
      return {
        sale: useCatalog ? selected?.price : CONFIG.pricing.sale ?? selected?.price,
        list: useCatalog ? selected?.old : CONFIG.pricing.list ?? selected?.old
      };
    }

${fs.readFileSync(path.join(base,'product-view.js'),'utf8').trimEnd()}

    function readQty()`);
const galleryStart = script.indexOf('    // EDIT S08:');
const galleryEnd = script.indexOf("    $('#bw-main-form').addEventListener('submit'",galleryStart);
assert(galleryStart >= 0 && galleryEnd > galleryStart);
script = script.slice(0,galleryStart) + `    let galleryIndex = -1;
    let pointerStart = null;
    const stage = $('.bw-gallery-stage');
    function showGallery(index) {
      const entries = state.main?.gallery || [];
      if (!entries.length) return;
      galleryIndex = (index + entries.length) % entries.length;
      const entry = entries[galleryIndex];
      setImage($('#bw-main-image'), entry.img || entry.full, CONFIG.main.name + ' รูป ' + (galleryIndex + 1));
      $('#bw-gallery-count').textContent = (galleryIndex + 1) + ' / ' + entries.length;
      $('#bw-thumbnails').querySelectorAll('button').forEach((button,i) => button.setAttribute('aria-pressed', String(i === galleryIndex)));
    }
    stage.addEventListener('pointerdown', event => { pointerStart = {x:event.clientX,y:event.clientY}; });
    stage.addEventListener('pointerup', event => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
      const count = state.main?.gallery.length || 0;
      if (count > 1) showGallery(galleryIndex < 0 ? (dx < 0 ? 0 : count - 1) : galleryIndex + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener('pointercancel', () => { pointerStart = null; });

    const qtyInput = $('#bw-qty');
    qtyInput.max = String(CONFIG.maxQty);
    qtyInput.addEventListener('input',refresh);
    for (const [selector,step] of [['#bw-qty-minus',-1],['#bw-qty-plus',1]]) {
      $(selector).addEventListener('click',() => {
        qtyInput.value = String(Math.min(CONFIG.maxQty,Math.max(1,(readQty() ?? 1) + step)));
        refresh();
      });
    }
` + script.slice(galleryEnd);
replace('      p.gallery.slice(0,16).forEach((entry,index)=>{','      p.gallery.forEach((entry,index)=>{');
new Function(script);
assert(/^<style>/.test(css) && /<\/style>$/.test(css));
const template = JSON.stringify({html, css, script}).replace(/</g, '\\u003c');
const client = fs.readFileSync(path.join(base, 'client.js'), 'utf8');
new Function(client);
const shell = fs.readFileSync(path.join(base, 'shell.html'), 'utf8');
fs.mkdirSync(path.join(base, 'dist'), {recursive:true});
fs.writeFileSync(path.join(base,'dist/index.html'), shell.replace('<!-- APP_SCRIPT -->', () => `<script id="templates" type="application/json">${template}</script>\n<script>${client.replace(/<\/script/gi, '<\\/script')}</script>`));
console.log('Built dist/index.html from the three pasted V2 templates');
