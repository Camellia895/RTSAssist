// review_translations.js — 打印若干条译文供人工/审校核对（ReadMe 块 + Luna 抽样 + %% 命中）。
const fs = require('fs');
const path = require('path');
const ZH = process.argv[2];

const show = (shard, pick) => {
  const arr = JSON.parse(fs.readFileSync(path.join(ZH, shard), 'utf8'));
  console.log('\n########## ' + shard + ' ##########');
  arr.forEach((e, i) => {
    if (pick && !pick(e, i)) return;
    console.log(`\n--- [${i}] ${e.locator} ---`);
    console.log('EN: ' + JSON.stringify(e.en));
    console.log('ZH: ' + JSON.stringify(e.zh));
  });
};

// 1) %% 命中
for (const s of ['worklist_02_ini_comments.json', 'worklist_03_docs.json', 'worklist_01_luna_settings.json']) {
  const arr = JSON.parse(fs.readFileSync(path.join(ZH, s), 'utf8'));
  arr.forEach((e, i) => {
    if (e.zh.includes('%%')) console.log(`[%%] ${s}[${i}] ${e.locator}\n   EN: ${JSON.stringify(e.en)}\n   ZH: ${JSON.stringify(e.zh)}`);
  });
}

// 2) 换行数不一致的 ReadMe 块
show('worklist_03_docs.json', (e) => {
  const a = (e.en.match(/\n/g) || []).length, b = (e.zh.match(/\n/g) || []).length;
  return e.field === 'wholeText-block' && a !== b;
});

// 3) Luna 抽样（前 12 条 + 页签名）
show('worklist_01_luna_settings.json', (e, i) => i < 12 || e.en === 'Dev Tools');
