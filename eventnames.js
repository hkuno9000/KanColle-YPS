$event_sally_tag_names = {
// id: tagname.
// https://*.kancolle-server.com/kcs2/img/common/common_event.json?version=6.2.0.0
// https://*.kancolle-server.com/kcs2/img/common/common_event.png?version=6.2.0.0
// jsonのcommon_event_番号並びと、札ID番号並びは一致している.
// 下記手順にて番号並び順に画像切り取り座標を抜き出し、その位置に描かれている札名を列記する.
// 1. デベロッパーツール＞ネットワーク＞フィルター：common_event＞common_event.json＞プレビュー＞先頭のframesを右クリック＞グローバル変数として保存（temp1)
// 2. デベロッパーツールのコンソールにて下記コードを実行する.
// common_event = temp1; v = {}; for (i in common_event.frames) { v[i] = common_event.frames[i].frame; }; console.table(v)
// あるいはAI解析にかける：プロンプト＞添付した画像を、添付したjsonデータに従って、幅47の部分画像を抽出し、記載された文字をOCRで取り出してください
// 2025秋イベント【前段作戦】「逆転！ナルヴィク攻防戦」
1: '改R4計画艦隊',          // E-1
2: 'ナルヴィク先遣隊',      // E-2
3: 'ナルヴィク防衛主隊',    // E-2
4: 'ナルヴィク駐留艦隊',    // E-4
5: 'イギリス本国艦隊',      // E-4
6: 'イギリス機動部隊',      // E-4
// 2025秋イベント【後段作戦】「？？？？？？？？」
9999: null
};
