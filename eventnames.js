$event_sally_tag_names = {
// id: tagname.
// https://*.kancolle-server.com/kcs2/img/common/common_event.json?version=6.2.1.0
// https://*.kancolle-server.com/kcs2/img/common/common_event.png?version=6.2.1.0
// jsonのcommon_event_番号並びと、札ID番号並びは一致している.
// 下記手順にて番号並び順に画像切り取り座標を抜き出し、その位置に描かれている札名を列記する.
// 1. デベロッパーツール＞ネットワーク＞フィルター：common_event＞common_event.json＞プレビュー＞先頭のframesを右クリック＞グローバル変数として保存（temp1)
// 2. デベロッパーツールのコンソールにて下記コードを実行する.
// common_event = temp1; v = {}; for (i in common_event.frames) { v[i] = common_event.frames[i].frame; }; console.table(v)
// あるいはAI解析にかける：プロンプト＞添付した画像を、添付したjsonデータに従って、幅47から49の部分画像を抽出し、記載された文字をOCRで取り出してください
// 2025秋イベント【前段作戦】「逆転！ナルヴィク攻防戦」
1: '改R4計画艦隊',          // E-1
2: 'ナルヴィク先遣隊',      // E-2
3: 'ナルヴィク防衛主隊',    // E-2
4: 'ナルヴィク駐留艦隊',    // E-3
5: 'イギリス本国艦隊',      // E-3
6: 'イギリス機動部隊',      // E-3
// 2025秋イベント【後段作戦】「要撃！敵機動部隊捜索撃滅」
7: '欧州遠征収容艦隊',      // E-4
8: '拡張第三十一戦隊',      // E-4
9: '機動部隊',              // E-4
10: '礼号作戦部隊',         // E-4
11: '第百四戦隊',           // E-5
12: '横須賀防備戦隊',       // E-5
13: '連合艦隊',             // E-5
14: '決戦艦隊',             // E-5
9999: null
};
