// -*- coding: utf-8 -*-
var $ship_list		= load_storage('ship_list');
var $enemy_db		= load_storage('enemy_db');
var $mst_ship		= load_storage('mst_ship');
var $mst_slotitem	= load_storage('mst_slotitem');
var $mst_mission	= load_storage('mst_mission');
var $mst_useitem	= load_storage('mst_useitem');
var $mst_mapinfo	= load_storage('mst_mapinfo');
var $weekly			= load_storage('weekly');
var $logbook		= load_storage('logbook', []);
var $slotitem_list	= load_storage('slotitem_list');
var $tmp_ship_id = -1000;	// ドロップ艦の仮ID.
var $tmp_slot_id = -1000;	// ドロップ艦装備の仮ID.
var $max_ship = 0;
var $max_slotitem = 0;
var $combined_flag = 0;
var $fdeck_list = {};
var $ship_fdeck = {};
var $ship_escape = {};	// 護衛退避したshipidのマップ.
var $mapinfo_rank = {};	// 海域難易度 0:なし, 1:丙, 2:乙, 3:甲.
var $next_mapinfo = null;
var $next_enemy = null;
var $is_boss = false;
var $material = {
	// [燃料,弾薬,鋼材,ボーキ, バーナー,バケツ,歯車,螺子]
	mission: [0,0,0,0, 0,0,0,0],	///< 遠征累計.
	quest  : [0,0,0,0, 0,0,0,0],	///< 任務累計.
	charge : [0,0,0,0, 0,0,0,0],	///< 補給累計.
	ndock  : [0,0,0,0, 0,0,0,0],	///< 入渠累計.
	dropitem    : [0,0,0,0, 0,0,0,0],	///< 道中資源累計.
	createship  : [0,0,0,0, 0,0,0,0],	///< 艦娘建造/改造累計.
	createitem  : [0,0,0,0, 0,0,0,0],	///< 装備開発累計.
	remodelslot : [0,0,0,0, 0,0,0,0],	///< 装備改修累計.
	destroyship : [0,0,0,0, 0,0,0,0],	///< 艦娘解体累計.
	destroyitem : [0,0,0,0, 0,0,0,0],	///< 装備破棄累計.
	now : [],	///< 現在資材. 初回は全項目undefinedとする.
	beg : null,	///< 初期資材. 初回更新時にnowのコピーを保持する.
	diff: ""	///< 変化量メッセージ.
};
var $quest_count = -1;
var $quest_exec_count = 0;
var $quest_list = {};
var $battle_count = 0;
var $ndock_list = {};
var $do_print_port_on_ndock = false;
var $kdock_list = {};
var $battle_deck_id = -1;
var $battle_log = [];
var $last_mission = {};
var $beginhps = null;
var $beginhps_c = null;
var $f_damage = 0;
var $guess_win_rank = '?';
var $guess_info_str = '';
var $pcDateTime = null;
var $svDateTime = null;
var $newship_slots = null;
var $enemy_formation = '';
var $enemy_ship_names = [];

//-------------------------------------------------------------------------
// Ship クラス.
function Ship(data, ship) {
	this.p_cond	= (ship) ? ship.c_cond : 49;
	this.c_cond	= data.api_cond;
	this.maxhp	= data.api_maxhp;
	this.nowhp	= data.api_nowhp;
	this.slot	= data.api_slot;	// []装備ID.
	this.onslot	= data.api_onslot;	// []装備数.
	this.bull	= data.api_bull;	// 弾薬.
	this.fuel	= data.api_fuel;	// 燃料.
	this.id		= data.api_id;		// 背番号.
	this.lv		= data.api_lv;
	this.locked	= data.api_locked;
	this.ndock_time	= data.api_ndock_time;
	this.ndock_item	= data.api_ndock_item; // 入渠消費量[燃料,鋼材].
	this.ship_id	= data.api_ship_id;
	this.kyouka	= data.api_kyouka;	// 近代化改修による強化値[火力,雷装,対空,装甲,運].
	this.nextlv	= data.api_exp[1];
}

Ship.prototype.name_lv = function() {
	return ship_name(this.ship_id) + 'Lv' + this.lv;
};

Ship.prototype.kira_cond_diff_name = function() {
	return kira_name(this.c_cond) + this.c_cond + diff_name(this.c_cond, this.p_cond);
};

Ship.prototype.fuel_max = function() {
	var max = $mst_ship[this.ship_id].api_fuel_max;
	return max == null ? 0 : max; // if null or undefined then 0
};

Ship.prototype.bull_max = function() {
	var max = $mst_ship[this.ship_id].api_bull_max;
	return max == null ? 0 : max; // if null or undefined then 0
};

Ship.prototype.fuel_name = function() {
	var max = $mst_ship[this.ship_id].api_fuel_max;
	if (max && this.fuel < max) return percent_name(this.fuel, max);
	return ''; // 100% or unknown
};
Ship.prototype.bull_name = function() {
	var max = $mst_ship[this.ship_id].api_bull_max;
	if (max && this.bull < max) return percent_name(this.bull, max);
	return ''; // 100% or unknown
};

Ship.prototype.charge = function(data) { ///< 補給.
	var d_fuel  = data.api_fuel - this.fuel;
	var d_bull  = data.api_bull - this.bull;
	if (this.lv > 99) {	// ケッコンカッコカリ艦は消費量15%軽減.
		d_fuel = Math.floor(d_fuel * 0.85);
		d_bull = Math.floor(d_bull * 0.85);
	}
	this.fuel   = data.api_fuel;
	this.bull   = data.api_bull;
	this.onslot = data.api_onslot;
	$material.charge[0] -= d_fuel;
	$material.charge[1] -= d_bull;
};

Ship.prototype.highspeed_repair = function() { ///< 高速修復.
	this.nowhp = this.maxhp;
	this.ndock_time = 0;
	delete $ndock_list[this.id];
};

Ship.prototype.can_kaizou = function() {
	var afterlv = $mst_ship[this.ship_id].api_afterlv;
	return afterlv && afterlv <= this.lv;
};

Ship.prototype.max_kyouka = function() {
	var mst = $mst_ship[this.ship_id];
	return [
		mst.api_houg[1] - mst.api_houg[0],	// 火力.
		mst.api_raig[1] - mst.api_raig[0],	// 雷装.
		mst.api_tyku[1] - mst.api_tyku[0],	// 対空.
		mst.api_souk[1] - mst.api_souk[0],	// 装甲.
		mst.api_luck[1] - mst.api_luck[0]	// 運.
	];
};

Ship.prototype.begin_shipid = function() {
	var mst = $mst_ship[this.ship_id];
	return mst.yps_begin_shipid ? mst.yps_begin_shipid : this.ship_id;
};

Ship.prototype.slot_names = function() {
	var slot = this.slot;
	var onslot = this.onslot;
	var maxslot = $mst_ship[this.ship_id].api_maxeq;
	var a = [];
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value) {
			a.push(slotitem_name(value.item_id, value.level, onslot[i], maxslot[i]));
		}
	}
	return a.join(', ');
};

Ship.prototype.next_level = function () {
	return 'あと ' + this.nextlv;
};

//------------------------------------------------------------------------
// データ保存と更新.
//
function load_storage(name, def) {
	if (!def) def = {};
	var v = localStorage[name];
	return v ? JSON.parse(v) : def;
}

function save_storage(name, v) {
	localStorage[name] = JSON.stringify(v);
}

function update_ship_list(list, is_delta) {
	if (!list) return;
	// update ship_list
	var prev_ship_list = $ship_list;
	if (!is_delta) $ship_list = {};
	list.forEach(function(data) {
		var prev = prev_ship_list[data.api_id];
		var ship = new Ship(data, prev);
		$ship_list[data.api_id] = ship;
		if ($newship_slots && !prev) {
			// ship2廃止によりドロップ艦の装備数が母港帰還まで反映できなくなったので、母港帰還時に新規入手艦の装備数を記録保存し、
			// ドロップ時に装備数分のダミー装備IDを用意する. 初入手艦など未記録の艦は装備数0となるので、装備数が少なく表示される場合がある.
			if (ship.id < 0) {	// on_battle_result で仮登録するドロップ艦の場合.
				for (var slots = $newship_slots[ship.ship_id]; slots; --slots) { // 装備数未登録なら何もしない(装備数合計が少なく表示される)
					$slotitem_list[$tmp_slot_id] = null; // 個数を合せるためnullのダミーエントリを追加する. 母港旗艦(slot_itemパケット)でリストが全更新される.
					ship.slot.push($tmp_slot_id--); // 初期装備数分のダミー装備IDを載せる. 母港帰還(portパケット)により正しい値に上書きされる.
				}
			}
			else if (ship.lv == 1) {	// 海域ドロップ、報酬、建造などにより新規入手したLv1艦の場合.
				$newship_slots[ship.ship_id] = count_unless(ship.slot, -1); // 初期装備数を記録する.
			}
		}
	});
	if (!$newship_slots) {
		// ゲーム開始直後の保有艦リスト更新では、別環境で入手済みの既存Lv1艦(装備変更の可能性あり)も新規入手扱いになるので都合が悪い.
		// よって $newship_slots のロードをここで行い、開始直後の装備数記録をスキップする.
		$newship_slots = load_storage('newship_slots');	// この環境で保存した新規艦の初期装備数をロードする.
		for (var i in $init_newship_slots) {			// 既知艦の初期装備個数を上書きする.
			var n = $init_newship_slots[i];
			if (n != null)
				$newship_slots[i] = n;
		}
	}
	save_storage('ship_list', $ship_list);
	save_storage('newship_slots', $newship_slots);
}

function delta_update_ship_list(list) {
	update_ship_list(list, true);
}

function update_fdeck_list(list, is_delta) {
	if (!list) return;
	if (!is_delta) {
		$fdeck_list = {};
		$ship_fdeck = {};
	}
	for (var idx in list) {	// list が Array でも Object($fdeck_list自身) でも扱えるようにする.
		var deck = list[idx];
		$fdeck_list[deck.api_id] = deck;
		for (var i in deck.api_ship) {
			var ship_id = deck.api_ship[i];
			if (ship_id != -1) $ship_fdeck[ship_id] = deck.api_id;
		}
	}
}

function delta_update_fdeck_list(list) {
	update_fdeck_list(list, true);
}

function update_ndock_complete() {
	// $ndock_list のクリア前に現在のリストで入渠完了した艦がないかチェックする
	for (var id in $ndock_list) {
		var d = $ndock_list[id];
		var ship = $ship_list[id];
		if (d.api_complete_time < $svDateTime.getTime() + 60000) {
			//alert(d.api_complete_time_str);
			ship.highspeed_repair();
			$do_print_port_on_ndock = true;
		}
	}
}

function update_ndock_list(list) {
	if (!list) return;
	$ndock_list = {};
	list.forEach(function(data) {
		var ship_id = data.api_ship_id;
		if (ship_id) $ndock_list[ship_id] = data;
	});
}

function update_kdock_list(list) {
	if (!list) return;
	$kdock_list = {};
	list.forEach(function(data) {
		// state: -1:未開放, 0:空き, 1:不明, 2:建造中, 3:完成.
		if (data.api_state >= 2) $kdock_list[data.api_id] = data;
	});
}

function update_mst_ship(list) {
	if (!list) return;
	$mst_ship = {};
	var before = {};
	list.forEach(function(data) {
		$mst_ship[data.api_id] = data;
		if (data.api_aftershipid)
			before[data.api_aftershipid] = data.api_id;
	});
	for (var id in $mst_ship) {
		var b = before[id];
		if (b) {
			$mst_ship[id].yps_before_shipid = b; // 改装前の艦種ID.
			do {
				$mst_ship[id].yps_begin_shipid = b; // 未改装の艦種ID.
			} while (b = before[b]);
		}
	}
	save_storage('mst_ship', $mst_ship);
}

function update_mst_slotitem(list) {
	if (!list) return;
	$mst_slotitem = {};
	list.forEach(function(data) {
		$mst_slotitem[data.api_id] = data;
	});
	save_storage('mst_slotitem', $mst_slotitem);
}

function update_mst_mission(list) {
	if (!list) return;
	$mst_mission = {};
	list.forEach(function(data) {
		$mst_mission[data.api_id] = data;
	});
	save_storage('mst_mission', $mst_mission);
}

function update_mst_useitem(list) {
	if (!list) return;
	$mst_useitem = {};
	list.forEach(function(data) {
		$mst_useitem[data.api_id] = data;
	});
	save_storage('mst_useitem', $mst_useitem);
}

function update_mst_mapinfo(list) {
	if (!list) return;
	$mst_mapinfo = {};
	list.forEach(function(data) {
		$mst_mapinfo[data.api_id] = data;
	});
	save_storage('mst_mapinfo', $mst_mapinfo);
}

function get_weekly() {
	var wn = Date.now() - Date.UTC(2013, 4-1, 22, 5-9, 0); // 2013-4-22 05:00 JST からの経過ミリ秒数.
	wn = Math.floor(wn / (7*24*60*60*1000)); // 経過週数に変換する.
	if ($weekly == null || $weekly.week != wn) {
		$weekly = {
			quest_state : 0, // あ号任務状況(1:未遂行, 2:遂行中, 3:達成)
			sortie    : 0,
			boss_cell : 0,
			win_boss  : 0,
			win_S     : 0,
			week      : wn
		};
	}
	return $weekly;
}

function save_weekly() {
	save_storage('weekly', $weekly);
}

function push_to_logbook(log) {
	if ($logbook.push(log) > 50) $logbook.shift(); // 50を超えたら古いものから削除する.
	save_storage('logbook', $logbook);
}

//------------------------------------------------------------------------
// 表示文字列化.
//
function fraction_name(num, denom) {
	if (num >= denom)
		return '達成';
	else
		return num + '/' + denom;
}

function weekly_name() {
	var w = get_weekly();
	return '(出撃数:'  + fraction_name(w.sortie, 36)
		+ ', ボス勝利:' + fraction_name(w.win_boss, 12)
		+ ', ボス到達:' + fraction_name(w.boss_cell, 24)
		+ ', S勝利:'   + fraction_name(w.win_S, 6)
		+ ')';
}

function diff_name(now, prev) {		// now:1, prev:2 -> "(-1)"
	var diff = now - prev;	// 演算項目のどちらかがundefinedなら減算結果はNaNとなる. 項目がnullならば0として減算する.
	if (prev == null) return '';	// nullかundefinedなら増減なしと見做して空文字列を返す.
	else if (diff > 0) return '(+' + diff + ')'; // with plus sign
	else if (diff < 0) return '(' + diff +')';   // with minus sign
	else /* diff == 0 */ return '';
}

function percent_name(now, max, decimal_digits) {	// now:1, max:2 -> "50%"
	if (!max) return '';
	var pow10 = decimal_digits ? Math.pow(10, decimal_digits) : 1;
	return Math.floor(100 * pow10 * now / max) / pow10 + '%';
}

function percent_name_unless100(now, max, decimal_digits) {	// now:1, max:2 -> "(50%)"
	if (!max || now == max) return '';
	return '(' + percent_name(now, max, decimal_digits) + ')';
}

function fraction_percent_name(now, max) {	// now:1, max:2 -> "1/2(50%)"
	if (!max) return '';	// 0除算回避.
	var d = (100 * now / max < 1) ? 1 : 0; // 1%未満なら小数部2桁目を切り捨て、1%以上なら小数部切り捨て.
	return now + '/' + max + '(' + percent_name(now, max, d) + ')';
}

function kira_name(cond) {
	return (cond >= 85) ? '*** ' : // 三重キラ.
		   (cond >= 53) ? '** ' : // 回避向上キラ.
		   (cond >= 50) ? '* ' : // キラ.
		   (cond == 49) ? '. ' : // 通常.
		   (cond >= 30) ? '> ' : // 疲労.
		   (cond >= 20) ? '>> ' : // オレンジ疲労.
		 /* cond 0..19 */ '>>> '; // 赤疲労.
}

function kira_names(list) {
	var count = {};	// kira_name をキーとするカウンター.
	list.forEach(function(cond) {
		var name = kira_name(cond).trim();
		if (count[name] == null)
			count[name] = 1;
		else
			count[name]++;
	});
	var msg = [];
	var n;
	if (n = count['***']) msg.push('***' + n);
	if (n = count['**'])  msg.push('**' + n);
	if (n = count['*'])   msg.push('*' + n);
//	if (n = count['.'])   msg.push('通常' + n); --- 通常は表示しない.
	if (n = count['>'])   msg.push('疲労' + n);
	if (n = count['>>'])  msg.push('橙疲労' + n);
	if (n = count['>>>']) msg.push('赤疲労' + n);
	return msg.join(' ');
}

function material_name(id) {
	switch (parseInt(id, 10)) {
		case 1: return '燃料';
		case 2: return '弾薬';
		case 3: return '鋼材';
		case 4: return 'ボーキ';
		case 5: return '高速建造材';	// バーナー.
		case 6: return '高速修復材';	// バケツ.
		case 7: return '開発資材';	// 歯車.
		case 8: return '改修資材';	// ネジ.
		case 10: return '家具箱小';
		case 11: return '家具箱中';
		case 12: return '家具箱大';
		default: return 'id(' + id + ')';
	}
}

function formation_name(id) {
	switch (parseInt(id, 10)) {	// 連合艦隊戦闘では id が数値ではなく文字列になっている.
		case 1: return '単縦';
		case 2: return '複縦';
		case 3: return '輪形';
		case 4: return '梯形';
		case 5: return '単横';
		case 11: return '連合対潜警戒';
		case 12: return '連合前方警戒';
		case 13: return '連合輪形陣';
		case 14: return '連合戦闘隊形';
		default: return id.toString();
	}
}

function match_name(id) {
	switch (id) {
		case 1: return '同航';
		case 2: return '反航';
		case 3: return 'Ｔ字有利';
		case 4: return 'Ｔ字不利';
		default: return id.toString();
	}
}

function support_name(id) {	///@param id	支援タイプ api_support_flag
	switch (id) {
		case 1: return '航空支援';
		case 2: return '支援射撃';
		case 3: return '支援長距離雷撃';
		default: return id.toString();
	}
}

function seiku_name(id) {	///@param id	制空権 api_disp_seiku
	switch (id) {
		case 1: return '制空権確保';
		case 2: return '航空優勢';
		case 0: return '航空互角';
		case 3: return '航空劣勢';
		case 4: return '制空権喪失';
		default: return id.toString();
	}
}

function search_name(id) {	///@param id	索敵結果 api_search[]
	switch (id) {
		case 1: return '敵艦隊発見!';
		case 2: return '敵艦隊発見!索敵機未帰還機あり';
		case 3: return '敵艦隊発見できず…索敵機未帰還機あり';
		case 4: return '敵艦隊発見できず…';
		case 5: return '敵艦隊発見!(索敵機なし)';
		case 6: return 'なし';
		default: return id.toString();
	}
}

function mission_clear_name(cr) {	///@param c	遠征クリア api_clear_result
	switch (cr) {
		case 1: return '成功';
		case 2: return '大成功';
		default: return '失敗';
	}
}

function slotitem_name(id, lv, n, max) {
	var item = $mst_slotitem[id];
	if (!item) return id.toString();	// unknown slotitem.
	var name = item.api_name;
	if (lv >= 1) name += '★+' + lv;	// 改修レベルを追加する.
	if (is_airplane(item) && n) name += 'x' + n + percent_name_unless100(n, max);	// 航空機なら、機数と搭載割合を追加する.
	return name;
}

function slotitem_names(idlist) {
	if (!idlist) return '';
	var names = [];
	for (var i in idlist) {
		var id = idlist[i];
		if (id > 0) names.push(slotitem_name(id));
	}
	return names.join(', ');
}

function ship_name(id) {
	var ship = $mst_ship[id];
	if (ship) {
		id = ship.api_name;
		if (ship.api_sortno == null && ship.api_yomi.length > 1) {
			id += ship.api_yomi; // 'elite', 'flag ship' ...
		}
	}
	return id.toString();
}

function shiplist_names(list) {	// Shipの配列をlv降順に並べて、","区切りの艦名Lv文字列化する.
	list.sort(function(a, b) { return (b.lv == a.lv) ? a.id - b.id : b.lv - a.lv; }); // lv降順、同一lvならid昇順(古い順)でソートする.
	var names = [];
	var last = null;
	for (var i in list) {
		if (!last || last.ship != list[i]) names.push(last = {count:0, ship:list[i]});
		last.count++;
	}
	for (var i in names) {
		var e = names[i];
		var name = e.ship.name_lv();
		var fdeck = $ship_fdeck[e.ship.id];
		if (fdeck) name = '(艦隊' + fdeck + ')' + name; // 頭に艦隊番号を付ける.
		if (e.count > 1) name += "x" + e.count;	// 同一艦は x N で束ねる.
		names[i] = name;
	}
	return names.join(', ');
}

function msec_name(msec) {
	var sec = msec / 1000;
	var min = sec / 60;
	var hh = min / 60;
	if (hh  >= 2) return hh.toFixed(1) + '時間';
	if (min >= 2) return min.toFixed() + '分';
	return sec.toFixed() + '秒';
}

function damage_name(nowhp, maxhp) {
	var r = nowhp / maxhp;
	return (r <= 0) ? '撃沈---'
		: (r <= 0.25) ? '大破!!!'
		: (r <= 0.50) ? '中破'
		: (r <= 0.75) ? '小破'
		: (r <= 0.85) ? '..'	// 軽微2.
		: (r <  1.00) ? '.'		// 軽微1.
		: '*';					// 無傷.
}

function battle_type_name(a) {
	switch (a) {
	case 0: return '砲撃戦';
	case 1: return 'レーザー';
	case 2: return '連撃';
	case 3: return '主副カットイン';
	case 4: return '主電カットイン';
	case 5: return '主徹カットイン';
	case 6: return '主主カットイン';
	default: return a; // 不明.
	}
}

function battle_sp_name(a) {
	switch (a) {
	case 0: return '砲撃戦';
	case 1: return '連撃';
	case 2: return '主魚カットイン';
	case 3: return '魚魚カットイン';
	case 4: return '主副カットイン';
	case 5: return '主主カットイン';
	default: return a; // 不明.
	}
}

function battle_cl_name(a) {
	switch (a) {
	case 0: return 'miss';
	case 1: return 'hit';
	case 2: return 'critical';
	default: return a; // 不明.
	}
}

//------------------------------------------------------------------------
// データ解析.
//
function decode_postdata_params(params) {
	var r = {};
	if (params instanceof Array) params.forEach(function(data) {
		if (data.name && data.value) {
			var name  = decodeURI(data.name);
			var value = decodeURI(data.value);
			r[name] = (value == "" || isNaN(value)) ? value : +value;  // 数値文字列ならばNumberに変換して格納する. さもなくばstringのまま格納する.
		}
	});
	return r;
}

function request_date_time() {
	var s = $pcDateTime.toLocaleString();
	if ($pcDateTime != $svDateTime) {
		s += ', server:' + $svDateTime.toLocaleString();
	}
	return s;
}

function array_copy(dst, src) {
	for (var i = 0; i < src.length; ++i) dst[i] = src[i];
}

function count_if(a, value) {
	if (a instanceof Array)
		return a.reduce(function(count, x) { return count + (x == value); }, 0);
	else
		return (a == value) ? 1 : 0;
}

function count_unless(a, value) {
	if (a instanceof Array)
		return a.reduce(function(count, x) { return count + (x != value); }, 0);
	else
		return (a != value) ? 1 : 0;
}

function add_slotitem_list(data) {
	if (!data) return;
	if (data instanceof Array) {
		data.forEach(function(e) {
			add_slotitem_list(e);
		});
	}
	else if (data.api_slotitem_id) {
		$slotitem_list[data.api_id] = { item_id: data.api_slotitem_id, locked: data.api_locked, level: data.api_level };
	}
}

function slotitem_count(slot, item_id) {
	if (!slot) return 0;
	var count = 0;
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value && count_if(item_id, value.item_id)) ++count;
	}
	return count;
}

function slotitem_use(slot, item_id) {
	if (!slot) return 0;
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value && count_if(item_id, value.item_id)) {
			slot[i] = -1; return true;
		}
	}
	return false;
}

function slotitem_delete(slot) {
	if (!slot) return;
	slot.forEach(function(id) {
		delete $slotitem_list[id];
	});
}

function ship_delete(list) {
	if (!list) return;
	list.forEach(function(id) {
		var ship = $ship_list[id];
		if (ship) {
			slotitem_delete(ship.slot);
			delete $ship_list[id];
		}
	});
}

function is_airplane(item) {
	if (!item) return false;
	switch (item.api_type[2]) {
	case 6:	// 艦上戦闘機.
	case 7:	// 艦上爆撃機.
	case 8:	// 艦上攻撃機.
	case 9:	// 艦上偵察機.
	case 10:// 水上偵察機.
	case 11:// 水上爆撃機.
	case 25:// オートジャイロ.
	case 26:// 対潜哨戒機.
	case 41:// 大型飛行艇.
		return true;
	default:
		return false;
	}
}

function hp_status(nowhp, maxhp) {
	return (nowhp < 0 ? 0 : nowhp) + '/' + maxhp + ':' + damage_name(nowhp, maxhp);
}

function hp_status_on_battle(nowhp, maxhp, beginhp) {
	return (nowhp < 0 ? 0 : nowhp) + '/' + maxhp + diff_name(nowhp, beginhp) + ':' + damage_name(nowhp, maxhp);
}

function fleet_brief_status(deck, deck2) {
	var cond_list = [];
	var esc = 0, sunk = 0;
	var damage_H = 0;
	var damage_M = 0;
	var damage_L = 0;
	var fuel = 0, fuel_max = 0;
	var bull = 0, bull_max = 0;
	var list = deck.api_ship;
	if (deck2) list = list.concat(deck2.api_ship);
	for (var i in list) {
		var ship = $ship_list[list[i]];
		if (ship) {
			fuel += ship.fuel; fuel_max += ship.fuel_max();
			bull += ship.bull; bull_max += ship.bull_max();
			cond_list.push(ship.c_cond);
			var r = ship.nowhp / ship.maxhp;
			if ($ship_escape[ship.id]) esc++; // 退避.
			else if (r <= 0) sunk++; // 撃沈.
			else if (r <= 0.25) damage_H++; // 大破.
			else if (r <= 0.50) damage_M++; // 中破.
			else if (r <= 0.75) damage_L++; // 小破.
		}
	}
	return kira_names(cond_list)
		+ (fuel < fuel_max ? ' 燃料' + percent_name(fuel, fuel_max) : '')
		+ (bull < bull_max ? ' 弾薬' + percent_name(bull, bull_max) : '')
		+ (esc  ? ' 退避' + esc : '')
		+ (sunk ? ' 撃沈' + sunk : '')
		+ (damage_H ? ' 大破!!!' + damage_H : '')
		+ (damage_M ? ' 中破' + damage_M : '')
		+ (damage_L ? ' 小破' + damage_L : '')
		;
}

function push_fleet_status(msg, deck) {
	var lv_sum = 0;
	var fleet_ships = 0;
	var drumcan = {ships:0, sum:0, msg:''};
	for (var i = 0, ship, s_id; ship = $ship_list[s_id = deck.api_ship[i]]; ++i) {
		fleet_ships++;
		lv_sum += ship.lv;
		var hp_str = '';	// hp.
		var rp_str = '';	// 修理.
		if (ship.nowhp / ship.maxhp <= 0.75) { // 小破以上なら値を設定する.
			hp_str = hp_status(ship.nowhp, ship.maxhp);	// ダメージ.
			rp_str = msec_name(ship.ndock_time);		// 修理所要時間.
		}
		if ($ship_escape[s_id]) {
			hp_str = '退避';
		}
		var ndock = $ndock_list[s_id];
		if (ndock) {
			var c_date = new Date(ndock.api_complete_time);
			rp_str = '入渠' + ndock.api_id + ':' + c_date.toLocaleString();
		}
		msg.push('\t' + ship.kira_cond_diff_name()
			+ '\t' + ship.name_lv()
			+ '\t' + hp_str
			+ '\t' + rp_str
			+ '\t' + ship.fuel_name()
			+ '\t' + ship.bull_name()
			+ '\t' + ship.slot_names()
			+ '\t' + ship.next_level()
			);
		var d = slotitem_count(ship.slot, 75);	// ドラム缶.
		if (d) {
			drumcan.ships++;
			drumcan.sum += d;
		}
	}
	if (drumcan.sum) {
		drumcan.msg = 'ドラム缶x' + drumcan.sum + '個(' + drumcan.ships + '隻)';
	}
	msg.push('\t合計' + fleet_ships +'隻:\tLv' + lv_sum + '\t\t\t\t\t' + drumcan.msg);
}

function update_material(material, sum) {
	// material: [燃料,弾薬,鋼材,ボーキ, バーナー,バケツ,歯車,螺子] or [{api_id: ID, api_value: 値}, ...]
	// ID: 1:燃料, 2:弾薬, 3:鋼材, 4:ボーキ, 5:バーナー, 6:バケツ, 7:歯車, 8:螺子.
	var msg = [];
	for (var i = 0; i < material.length; ++i) {
		var id = i + 1;
		var value = material[i];	// number or Object
		if (value.api_id) {
			id = value.api_id;
			value = value.api_value;
		}
		var now = $material.now[id-1];	// 初回はundefined.
		var diff = diff_name(value, now);
		if (diff.length) {
			msg.push(material_name(id) + diff);
			if (sum) sum[id-1] += value - now;
		}
		$material.now[id-1] = value;
	}
	if (msg.length) $material.diff = msg.join(', ');
	if ($material.beg == null) $material.beg = $material.now.concat(); // 初回更新時にnowのコピーを保持する.
}

function diff_update_material(diff_material, sum) {
	// diff_material: [燃料増分,弾薬増分,鋼材増分,ボーキ増分].
	var m = diff_material.concat(); // 複製を作る.
	for (var i = 0; i < m.length; ++i) { m[i] += $material.now[i]; } // 増分値を絶対値に変換する.
	update_material(m, sum);
}

//------------------------------------------------------------------------
// デバッグダンプ.
//
function debug_print_mst() {
	var msg = ['YPS_mst_slotitem', '\t==id\t==name\t==type0\t==type1\t==type2\t==type3'];
	for (var id in $mst_slotitem) {
		var item = $mst_slotitem[id];
		msg.push('\t' + item.api_id + '\t' + item.api_name + '\t' + item.api_type.join('\t'));
	}
	var req = [];
	req.push('## DEBUG mst_slotitem');
	req.push(msg);
	chrome.extension.sendRequest(req);
}

function debug_print_newship_slots() {
	var msg = ['YPS_newship_slots', '\t==id:\t==slots\t==name'];
	var newship_slots = $newship_slots ? $newship_slots : load_storage('newship_slots');
	for (var id in $mst_ship) {
		var mst = $mst_ship[id];
		if (mst.yps_begin_shipid) continue; // 改造型を除外する.
		if (!mst.api_afterlv) continue; // 改造不能型（季節艦、深海棲艦）を除外する.
		msg.push('\t' + id + ':\t' + newship_slots[id] + ',\t// ' + ship_name(id) + '.');
	}
	var req = [];
	req.push('## DEBUG newship_slots');
	req.push(msg);
	chrome.extension.sendRequest(req);
}

//------------------------------------------------------------------------
// 母港画面表示.
//
function print_port() {
	var req = [request_date_time()];
	var unlock_names = [];
	var lock_condlist = {};
	var lock_kyoukalist = {};
	var lock_beginlist = {};
	var lock_repairlist = [];
	var unowned_names = [];
	var owned_ship_idset = {};
	var cond85 = 0;
	var cond53 = 0;
	var cond50 = 0;
	var unlock_lv10 = 0;
	var damage_H = 0;
	var damage_M = 0;
	var damage_L = 0;
	var damage_N = 0;
	var kaizou_list = [];
	var lockeditem_list = {};
	var lockeditem_count = 0;
	var $unlock_slotitem = 0;
	var $leveling_slotitem = 0;
	var drumcan_cond85 = [];
	var drumcan_cond53 = [];
	var drumcan_cond50 = [];
	var drumcan_condxx = [];
	//
	// ロック装備を種類毎に集計する.
	for (var id in $slotitem_list) {
		var value = $slotitem_list[id];
		if (value && value.locked) {
			var i = value.item_id;
			var lv = value.level;
			if (!lockeditem_list[i])
				lockeditem_list[i] = [];
			if (!lockeditem_list[i][lv])
				lockeditem_list[i][lv] = {count:0, shiplist:[]};
			lockeditem_list[i][lv].count++;
			lockeditem_count++;
		}
		if (value && value.level) {
			$leveling_slotitem++;
		}
	}
	//
	// ロック艦のcond別一覧、未ロック艦一覧、ロック装備持ち艦を検出する.
	for (var id in $ship_list) {
		var ship = $ship_list[id];
		owned_ship_idset[ship.begin_shipid()] = true;
		if (!ship.locked) {
			var n = count_unless(ship.slot, -1); // スロット装備数.
			$unlock_slotitem += n;
			var name = ship.name_lv();
			if (n > 0) name += "*"; // 装備持ちなら、名前の末尾に"*"を付ける.
			unlock_names.push(name);
			if (ship.lv >= 10) unlock_lv10++;
		}
		else {	// locked
			var cond = ship.c_cond;
			if (!lock_condlist[cond]) lock_condlist[cond] = [];
			lock_condlist[cond].push(ship);
			if      (cond >= 85) cond85++; // 三重キラ.
			else if (cond >= 53) cond53++; // 回避向上キラ.
			else if (cond >  49) cond50++; // キラ.
			var max_k = ship.max_kyouka();
			for (var i in max_k) {
				if (!lock_kyoukalist[i]) lock_kyoukalist[i] = [];
				if (max_k[i] > ship.kyouka[i]) lock_kyoukalist[i].push(ship);
			}
			if (!$ndock_list[id] && ship.nowhp < ship.maxhp) {
				var r = ship.nowhp / ship.maxhp;
				if      (r <= 0.25) damage_H++; // 大破.
				else if (r <= 0.50) damage_M++; // 中破.
				else if (r <= 0.75) damage_L++; // 小破.
				else                damage_N++; // 軽微.
				lock_repairlist.push(ship);
			}
			if (!$ndock_list[id] && !$ship_fdeck[id] && slotitem_count(ship.slot, 75) > 0) { // ドラム缶装備の待機艦を選別する.
				if     (cond >= 85) drumcan_cond85.push(ship);
				else if (cond >= 53) drumcan_cond53.push(ship);
				else if (cond > 49) drumcan_cond50.push(ship);
				else               drumcan_condxx.push(ship);
			}
			var b = ship.begin_shipid();
			if (!lock_beginlist[b]) lock_beginlist[b] = [];
			lock_beginlist[b].push(ship);
		}
		if (ship.slot) {
			ship.slot.forEach(function(id) {
				var value = $slotitem_list[id];
				if (value && value.locked)
					lockeditem_list[value.item_id][value.level].shiplist.push(ship);
			});
		}
		if (ship.can_kaizou()) kaizou_list.push(ship);
	}
	unlock_names.reverse();	// 最新の艦を先頭にする.
	var double_count = 0;
	for (var id in lock_beginlist) {
		var a = lock_beginlist[id];
		if (a.length > 1) double_count += a.length - 1; // ダブリ艦数を集計する.
	}
	for (var id in $mst_ship) {
		var mst = $mst_ship[id];
		if (mst.yps_begin_shipid) continue; // 改造型を除外する.
		if (!mst.api_afterlv) continue; // 改造不能型（季節艦、深海棲艦）を除外する.
		if (!owned_ship_idset[id]) unowned_names.push(ship_name(id)); // 未所有艦名をリストに加える.
	}
	//
	// 資材変化を表示する.
	req.push('資材増減数:' + $material.diff);
	var msg = ['YPS_material'
		, '\t'
		, '\t現在値'
		, '\t収支累計'
		, '\t==任務'
		, '\t==遠征'
		, '\t==道中'
		, '\t==補給'
		, '\t==入渠'
		, '\t==建造+改造'
		, '\t==解体'
		, '\t==開発'
		, '\t==改修'
		, '\t==破棄'
	];
	for (var i = 0; i < 8; ++i) {
		msg[1]  += '\t==' + material_name(i + 1);
		msg[2]  += '\t  ' + $material.now[i];
		msg[3]  += '\t  ' + ($material.now[i] - $material.beg[i]);
		msg[4]  += '\t  ' + $material.quest[i];
		msg[5]  += '\t  ' + $material.mission[i];
		msg[6]  += '\t  ' + $material.dropitem[i];
		msg[7]  += '\t  ' + $material.charge[i];
		msg[8]  += '\t  ' + $material.ndock[i];
		msg[9]  += '\t  ' + $material.createship[i];
		msg[10] += '\t  ' + $material.destroyship[i];
		msg[11] += '\t  ' + $material.createitem[i];
		msg[12] += '\t  ' + $material.remodelslot[i];
		msg[13] += '\t  ' + $material.destroyitem[i];
	}
	msg.push('---');
	req.push(msg);
	//
	// 艦娘保有数、未ロック艦一覧、未保有艦一覧、ダブリ艦一覧を表示する.
	var ships = Object.keys($ship_list).length;
	var space = $max_ship - ships;
	if (space <= 0)      req.push('### @!!艦娘保有数が満杯です!!@'); // 警告表示.
	else if (space <= 5) req.push('### @!!艦娘保有数の上限まで残り' + space + '!!@'); // 警告表示. 
	if (unlock_lv10) req.push('### @!!Lv10以上の未ロック艦があります!!@'); // 警告表示.
	req.push('艦娘保有数:' + ships + '/' + $max_ship
		+ '(未ロック:' + unlock_names.length
		+ ($unlock_slotitem ? '*' : '')
		+ ', ロック:' + (ships - unlock_names.length)
		+ ', ダブリ:' + double_count
		+ ', 未保有:' + unowned_names.length
		+ ')');
	var msg = ['YPS_ship_list'];
	if (unlock_names.length > 0) {
		msg.push('## 未ロック艦一覧(装備数*' + $unlock_slotitem + ')');
		msg.push('\t|' + unlock_names.join(', '));
	}
	if (unowned_names.length > 0) {
		msg.push('## 未保有艦一覧');
		msg.push('\t|' + unowned_names.join(', '));
	}
	if (double_count > 0)  {
		msg.push('## ロック艦ダブリ一覧');
		for (var id in lock_beginlist) {
			var a = lock_beginlist[id];
			if (a.length > 1) msg.push('\t|' + shiplist_names(a));
		}
	}
	msg.push('---');
	if (msg.length > 2) req.push(msg);
	//
	// 装備数、ロック装備一覧を表示する.
	var items = Object.keys($slotitem_list).length;
	var space = $max_slotitem - items;
	if (space <= 0)       req.push('### @!!装備保有数が満杯です!!@'); // 警告表示. 
	else if (space <= 20) req.push('### @!!装備保有数の上限まで残り' + space + '!!@'); // 警告表示. 
	req.push('装備保有数:' + items + '/' + $max_slotitem
		+ '(未ロック:' + (items - lockeditem_count)
		+ ', ロック:' + lockeditem_count
		+ ', 改修中:' + $leveling_slotitem + ')');
	var lockeditem_ids = Object.keys(lockeditem_list);
	if (lockeditem_ids.length > 0) {
		lockeditem_ids.sort(function(a, b) {	// 種別ID配列を表示順に並べ替える.
			var aa = $mst_slotitem[a];
			var bb = $mst_slotitem[b];
			var ret = aa.api_type[2] - bb.api_type[2]; // 装備分類の大小判定.
			if (!ret) ret = aa.api_sortno - bb.api_sortno; // 分類内の大小判定.
			// if (!ret) ret = a - b; // 種別ID値での大小判定.
			return ret;
		});
		var msg = ['YPS_lockeditem_list'];
		msg.push('## ロック装備一覧');
		msg.push('\t==装備名\t==個数\t==使用艦名'); // 表ヘッダ.
		lockeditem_ids.forEach(function(id) {
			for (var lv in lockeditem_list[id]) {
				var item = lockeditem_list[id][lv];
				msg.push('\t' + slotitem_name(id, lv) + '\t' + item.shiplist.length + '/' + item.count + '\t|' + shiplist_names(item.shiplist));
			}
		});
		msg.push('---');
		req.push(msg);
	}
	//
	// 改造可能一覧、近代化改修一可能覧を表示する.
	req.push('改造可能艦数:' + kaizou_list.length
			+ ', 近代化改修可能艦数('
			+   '火力:' + lock_kyoukalist[0].length
			+ ', 雷装:' + lock_kyoukalist[1].length
			+ ', 装甲:' + lock_kyoukalist[3].length
			+ ', 対空:' + lock_kyoukalist[2].length
			+ ', 運:'   + lock_kyoukalist[4].length
			+ ')');
	var msg = ['YPS_kai_list'];
	if (kaizou_list.length > 0) msg.push('## 改造可能艦一覧', '\t|' + shiplist_names(kaizou_list));
	msg.push('## 近代化改修可能艦一覧(ロック艦のみ)');
	var a = lock_kyoukalist[0]; if (a.length > 0) msg.push('### 火力', '\t|' + shiplist_names(a));
	var a = lock_kyoukalist[1]; if (a.length > 0) msg.push('### 雷装', '\t|' + shiplist_names(a));
	var a = lock_kyoukalist[3]; if (a.length > 0) msg.push('### 装甲', '\t|' + shiplist_names(a));
	var a = lock_kyoukalist[2]; if (a.length > 0) msg.push('### 対空', '\t|' + shiplist_names(a));
	var a = lock_kyoukalist[4]; if (a.length > 0) msg.push('### 運',   '\t|' + shiplist_names(a));
	msg.push('---');
	if (msg.length > 3) req.push(msg);
	//
	// ロック艦キラ付一覧を表示する.
	var msg = ['YPS_kira_list'];
	req.push('キラ付艦数:***' + cond85 + ' **' + cond53 + ' *' + cond50);
	msg.push('## ドラム缶装備の待機艦(遠征交代要員)');
	msg.push('\t==cond\t==艦名'); // 表ヘッダ
	if (drumcan_cond85.length > 0) msg.push('\t*** 85以上\t|' + shiplist_names(drumcan_cond85));
	if (drumcan_cond53.length > 0) msg.push('\t** 53以上\t|' + shiplist_names(drumcan_cond53));
	if (drumcan_cond50.length > 0) msg.push('\t* 50以上\t|' + shiplist_names(drumcan_cond50));
	if (drumcan_condxx.length > 0) msg.push('\t. 49以下\t|' + shiplist_names(drumcan_condxx));
	if (Object.keys(lock_condlist).length > 0) {
		msg.push('## ロック艦cond降順');
		msg.push('\t==cond\t==艦名'); // 表ヘッダ
		for (var cond = 100; cond >= 0; --cond) {
			var a = lock_condlist[cond];
			if (a) msg.push('\t' + kira_name(cond) + cond + '\t|' + shiplist_names(a));
		}
	}
	msg.push('---');
	if (msg.length > 2) req.push(msg);
	//
	// 入渠(修理)一覧表示する.
	var ndocks = Object.keys($ndock_list).length;
	var repairs = lock_repairlist.length;
	if (ndocks > 0 || repairs > 0) {
		var msg = ['YPS_ndock_list'];
		if (ndocks > 0) {
			msg.push('## 修理中');
			msg.push('\t==艦名Lv\t==燃料\t==弾薬\t==鋼材\t==ボーキ\t==完了時刻'); // 表ヘッダ.
			var ndoklst = {};
			for (var id in $ndock_list) {
				var d = $ndock_list[id];
				ndoklst[d.api_id] = id;
			}
			for (var i in ndoklst){
				var id = ndoklst[i];
				var d = $ndock_list[id];
				var ship = $ship_list[id];
				var c_date = new Date(d.api_complete_time);
				msg.push('\t' + ship.name_lv() 
					+ '\t  ' + d.api_item1
					+ '\t  ' + d.api_item2
					+ '\t  ' + d.api_item3
					+ '\t  ' + d.api_item4
					+ '\t' + c_date.toLocaleString()
					);
			}
		}
		if (repairs > 0) {
			msg.push('## 要修理(ロック艦のみ、修理時間降順)');
			msg.push('\t==艦名Lv\t==hp\t==修理'); // 表ヘッダ.
			lock_repairlist.sort(function(a, b) { return b.ndock_time - a.ndock_time; }); // 修理所要時間降順で並べ替える.
			for (var i in lock_repairlist) {
				var ship = lock_repairlist[i];
				msg.push('\t' + ship.name_lv() 
					+ '\t' + hp_status(ship.nowhp, ship.maxhp)
					+ '\t' + msec_name(ship.ndock_time)
					);
			}
		}
		req.push('修理中:' + ndocks + ', 要修理(大破' + damage_H + ', 中破' + damage_M + ', 小破' + damage_L + ', 軽微' + damage_N + ')');
		req.push(msg);
		msg.push('---');
	}
	//
	// 建造ドック一覧表示する.
	var kdocks = Object.keys($kdock_list).length;
	if (kdocks > 0) {
		var msg = ['YPS_kdock_list'];
		msg.push('\t==進捗\t==艦名\t==燃料\t==弾薬\t==鋼材\t==ボーキ\t==開発資材\t==完成時刻'); // 表ヘッダ.
		for (var id in $kdock_list) {
			var k = $kdock_list[id];
			var c_date = new Date(k.api_complete_time);
			var complete = (k.api_state == 3 || c_date.getTime() < Date.now());	// api_state 3:完成, 2:建造中, 1:???, 0:空き, -1:未開放. ※ 1以下は$kdock_listに載せない.
			msg.push('\t' + (complete ? '完成!!' : '建造中')
				+ '\t' + ship_name(k.api_created_ship_id)
				+ '\t  ' + k.api_item1
				+ '\t  ' + k.api_item2
				+ '\t  ' + k.api_item3
				+ '\t  ' + k.api_item4
				+ '\t  ' + k.api_item5
				+ '\t' + (complete ? '' : c_date.toLocaleString())
				);
		}
		req.push('建造中:' + kdocks);
		req.push(msg);
		msg.push('---');
	}
	//
	// 記録を表示する.
	if ($logbook.length > 0) {
		req.push('記録');
		var msg = ['YPS_logbook'];
		msg = msg.concat($logbook);
		req.push(msg);
	}
	//
	// 遂行中任務を一覧表示する.
	var quests = Object.keys($quest_list).length;
	if (quests > 0) {
		var msg = ['YPS_quest_list'];
		for (var id in $quest_list) {
			var quest = $quest_list[id];
			if (quest.api_state > 1) {
				var progress = (quest.api_state == 3) ? '* 達成!!'
					: (quest.api_progress_flag == 2) ? '* 遂行80%'
					: (quest.api_progress_flag == 1) ? '* 遂行50%'
					: '* 遂行中';
				var title = quest.api_title;
				if (quest.api_no == 214) title += weekly_name();
				msg.push(progress + ':' + title);
			}
		}
		if (msg.length > 1) {
			req.push('任務遂行数:' + $quest_exec_count + '/' + $quest_count);
			req.push(msg);
		}
	}
	if (quests != $quest_count) req.push('### 任務リストを先頭から最終ページまでめくってください');
	//
	// 各艦隊の情報を一覧表示する.
	for (var f_id in $fdeck_list) {
		var msg = ['YPS_fdeck_list' + f_id];
		msg.push('\t==cond\t==艦名Lv\t==hp\t==修理\t==燃料\t==弾薬\t==装備\t==次のLvまで'); // 表ヘッダ. 慣れれば不用な気がする.
		var deck = $fdeck_list[f_id];
		var brief;
		if ($combined_flag && f_id == 1) {
			var deck2 = $fdeck_list[2];	// 連合第二艦隊は2固定.
			push_fleet_status(msg, deck);
			push_fleet_status(msg, deck2);
			brief = fleet_brief_status(deck, deck2);
			req.push('## 連合艦隊1+2: ' + deck.api_name + ' + ' + deck2.api_name + ' (' + brief + ')');
		}
		else if ($combined_flag && f_id == 2) {
			continue;	// f_id == 1 にてまとめて表示済み.
		}
		else {
			push_fleet_status(msg, deck);
			brief = fleet_brief_status(deck);
			req.push('## 艦隊' + f_id + ': ' + deck.api_name + ' (' + brief + ')');
		}
		req.push(msg);
		var mission_end = deck.api_mission[2];
		if (mission_end > 0) {
			var d = new Date(mission_end);
			var id = deck.api_mission[1];
			req.push('遠征' + id + ' ' + $mst_mission[id].api_name + ': ' + d.toLocaleString());
		}
		else if (deck.api_id == $battle_deck_id) {
			req.push('出撃中: ' + $battle_log.join('\n→'));
		}
		else {
			if ($last_mission[f_id])
				req.push($last_mission[f_id]);
			else
				req.push('母港待機中');
		}
	}
	chrome.extension.sendRequest(req);
}

//------------------------------------------------------------------------
// イベントハンドラ.
//
function on_mission_check(category) {
	var req = ['## 任務'];
	for (var id in $quest_list) {
		var quest = $quest_list[id];
		if (quest.api_category == category) {	// 1:編成, 2:出撃, 3:演習, 4:遠征, 5:補給入渠, 6:工廠.
			var progress = (quest.api_state == 3) ? '達成!!'
				:         (quest.api_state == 1) ? '@!!未チェック!!@'
				: (quest.api_progress_flag == 2) ? '遂行80%'
				: (quest.api_progress_flag == 1) ? '遂行50%'
				: '遂行中';
			req.push('\t' + progress + '\t' + quest.api_title);
		}
	}
	var quests = Object.keys($quest_list).length;
	if (quests != $quest_count) req.push('### 任務リストを先頭から最終ページまでめくってください');
	if (req.length > 1) chrome.extension.sendRequest(req);
}

function on_next_cell(json) {
	var d = json.api_data;
	var g = json.api_data.api_itemget;
	if (!g) g = json.api_data.api_itemget_eo_comment; // EO 1-6 海域ゴールの取得資源.
	var h = json.api_data.api_happening;
	var area = d.api_maparea_id + '-' + d.api_mapinfo_no + '-' + d.api_no;
	$next_mapinfo = $mst_mapinfo[d.api_maparea_id * 10 + d.api_mapinfo_no];
	if (d.api_event_id == 5) {
		area += '(boss)';
		$is_boss = true;
	}
	if (g) {	// 資源マス.
		$material.dropitem[g.api_id-1] += g.api_getcount;	// 道中ドロップによる資材増加を記録する.
		var msg = area + ':' + material_name(g.api_id) + 'x' + g.api_getcount;
		$battle_log.push(msg);
		chrome.extension.sendRequest('## next item\n' + msg);
	}
	else if (h) {	// 渦潮マス.
		var msg = area + ':' + material_name(h.api_mst_id) + 'x' + -h.api_count;
		if (h.api_dentan) msg += '(電探により軽減あり)';
		$battle_log.push(msg);
		chrome.extension.sendRequest('## next loss\n' + msg);
	}
	else if (d.api_event_id == 6) {	// 非戦闘マス.
		var msg = area;
		switch (d.api_event_kind) {
		case 0: msg += ':気のせいだった'; break;
		case 1: msg += ':敵影を見ず'; break;
		case 2: msg += ':能動分岐'; break;
		default: msg += ':??'; break;
		}
		$battle_log.push(msg);
		chrome.extension.sendRequest('## next skip\n' + msg);
	}
	else {	// 戦闘マス.
		var msg = area;
		var db = $enemy_db[$next_enemy = area];
		if (db) {
			msg += ':敵遭遇回数記録\n\t==今週\t==通算\t==艦隊名(陣形):編成\t==司令部Lv\n';
			var week = get_weekly().week;
			if (db.week != week) {
				db.week = week;
				db.data.forEach(function(a) { a.wn = 0; }); // 今週回数をゼロに戻す.
			}
			var list = db.data.concat();
			list.sort(function(a, b) { return b.wn != a.wn ? b.wn - a.wn : b.n - a.n; }); // 回数降順に並べ替える.
			list.forEach(function(a) {
				msg += '\t  ' + a.wn + '\t  ' + a.n + '\t|' + a.name + '\t' + a.lv + '\n';
			});
		}
		msg = msg.replace(/潜水.級/g, '@!!$&!!@');
		chrome.extension.sendRequest('## next enemy\n' + msg);
	}
}

/// 護衛退避艦リストに艦IDを追加する. idx = 1..6, 7..12
function add_ship_escape(idx) {
	if (idx >= 7)
		$ship_escape[$fdeck_list[2].api_ship[idx-7]] = 1; // 第ニ艦隊から退避.
	else if (idx >= 1)
		$ship_escape[$fdeck_list[1].api_ship[idx-1]] = 1; // 第一艦隊から退避.
}

/// 護衛退避実行. 退避可能リストから１艦、護衛可能リストから１艦、合計2艦のみ退避できる.
function on_goback_port() {
	if (!$escape_info) return;
	add_ship_escape($escape_info.api_escape_idx[0]);	// 退避可能艦一覧の最初の艦を退避リストに追加する.
	add_ship_escape($escape_info.api_tow_idx[0]);		// 護衛可能艦一覧の最初の艦を退避リストに追加する.
}

function on_battle_result(json) {
	var d = json.api_data;
	var e = d.api_enemy_info;
	var g = d.api_get_ship;
	var h = d.api_get_useitem;
	var mvp   = d.api_mvp;
	var mvp_c = d.api_mvp_combined;
	var lost  = d.api_lost_flag;
	var msg  = '';
	var drop_ship_name = g ? g.api_ship_type + ':' + g.api_ship_name : null;
	var drop_item_name = h ? $mst_useitem[h.api_useitem_id].api_name : null;
	$escape_info = d.api_escape;	// on_goback_port()で使用する.
	if (e) {
		if ($next_mapinfo) {
			switch ($mapinfo_rank[$next_mapinfo.api_id]) {	// 難度選択海域ならば、艦隊名に難度表記を付加する.
			case 1: e.api_deck_name += '@丙'; break;
			case 2: e.api_deck_name += '@乙'; break;
			case 3: e.api_deck_name += '@甲'; break;
			}
		}
		var rank = d.api_win_rank;
		msg += e.api_deck_name;
		if (d.api_ship_id) {
			var total = count_unless(d.api_ship_id, -1);
			msg += '(' + d.api_dests + '/' + total + ')';
			if (rank == 'S' && $f_damage == 0) rank = '完S';
		}
		msg += ':' + rank;
		$guess_info_str += ', rank:' + rank;
		if (rank != $guess_win_rank) {
			$guess_info_str += '/' + $guess_win_rank + ' MISS!!';
			msg += '\n### @!!勝敗推定ミス!!@ ' + $guess_info_str;
			push_to_logbook($next_enemy + ', ' + $guess_info_str);
		}
		else if (/[DE]/.test(rank) || $guess_debug_log) {
			push_to_logbook($next_enemy + ', ' + $guess_info_str);
		}
		var log = $next_enemy + '(' + e.api_deck_name + '):' + $battle_info + ':' + rank;
		if (drop_ship_name) {
			log += '+' + g.api_ship_name; // drop_ship_name; 艦種を付けると冗長すぎるので艦名のみとする.
		}
		if (drop_item_name) {
			log += '+' + drop_item_name;
		}
		$battle_log.push(log);
		if (!/^演習/.test($next_enemy)) {
			// 敵艦隊構成と司令部Lvを記録する.
			var db = $enemy_db[$next_enemy] || { week:get_weekly().week, data:[] };
			var efleet = {
				name: e.api_deck_name + '(' + $enemy_formation + '): ' + $enemy_ship_names.join(', '), // 艦隊名(陣形):艦名,...
				wn: 1,					// 今週回数.
				n: 1,					// 通算回数.
				lv: d.api_member_lv		// 司令部Lv.
			};
			for (var i = 0; i < db.data.length; ++i) {		// db.dataに記録済みならば、その記録を更新する.
				if (db.data[i].name == efleet.name) {
					efleet.n += db.data[i].n;
					efleet.wn += db.data[i].wn;
					db.data[i] = efleet;
					break;
				}
			}
			if (i == db.data.length) db.data.push(efleet);	// 未記録ならば、db.dataへ新規追加する.
			$enemy_db[$next_enemy] = db;
			save_storage('enemy_db', $enemy_db);
		}
	}
	if (g) {
		var drop_ship = {
			api_id: $tmp_ship_id--, // 通常の背番号(1以上)と衝突しないように負の仮番号を作る. 母港に戻れば保有艦一覧が全体更新されるので、正しい背番号になる.
			api_ship_id: g.api_ship_id,
			api_cond: 49,
			api_lv: 1,
			api_maxhp: 1,
			api_nowhp: 1,
			api_locked: 0,
			api_slot: [],	// デフォルト装備が取れないので空にしておく.
			api_onslot: [0,0,0,0,0],
			api_kyouka: [0,0,0,0,0],
			api_exp: [0,100,0]
		};
		delta_update_ship_list([drop_ship]);
	}
	if (mvp) {
		var id = $fdeck_list[$battle_deck_id].api_ship[mvp-1];
		var ship = $ship_list[id];
		msg += '\nMVP: ' + ship.name_lv() + ' +' + d.api_get_ship_exp[mvp] + 'exp';
	}
	if (mvp_c) {
		var id = $fdeck_list[2].api_ship[mvp_c-1];
		var ship = $ship_list[id];
		msg += '\nMVP: ' + ship.name_lv() + ' +' + d.api_get_ship_exp_combined[mvp_c] + 'exp';
	}
	if (lost) {
		for (var i in lost) {
			if (lost[i] == 1) {
				var id = $fdeck_list[$battle_deck_id].api_ship[i-1];
				var ship = $ship_list[id];
				msg += '\nLOST: ' + ship.name_lv();
				ship_delete([id]);
			}
		}
	}
	if (drop_ship_name) {
		msg += '\n## drop ship\n' + drop_ship_name;
	}
	if (drop_item_name) {
		msg += '\n## drop item\n' + drop_item_name;
	}
	chrome.extension.sendRequest('## battle result\n' + msg);
}

function calc_damage(result, hp, battle, hc) {
	// hp ::= [-1, friend1...6, enemy1...6]
	// hc ::= [-1, combined1..6]
	if (!battle) return;
	if (battle.api_df_list && battle.api_damage) {
		// 砲撃戦:敵味方ダメージ集計.
		var df = battle.api_df_list;
		for (var i = 1; i < df.length; ++i) {
			for (var j = 0; j < df[i].length; ++j) {
				var target = df[i][j];
				if (hc && target <= 6)
					hc[target] -= Math.floor(battle.api_damage[i][j]);
				else
					hp[target] -= Math.floor(battle.api_damage[i][j]);
			}
		}
		// 敵味方砲撃詳報収集.
		for (var i = 1; i < df.length; ++i) {
			var at = battle.api_at_list[i]; if (hc && at <= 6) at += 20; // 攻撃艦No. 連合第二艦隊なら20の下駄履き.
			var si = battle.api_si_list[i]; // 装備配列.
			var cl = battle.api_cl_list[i]; // 命中配列.
			var ty = null;	// 攻撃種別
			if (battle.api_at_type) ty = battle_type_name(battle.api_at_type[i]);	// 昼戦攻撃種別.
			if (battle.api_sp_list) ty = battle_sp_name(battle.api_sp_list[i]);		// 夜戦攻撃種別.
			for (var j = 0; j < df[i].length; ++j) {
				var target = df[i][j]; if (hc && target <= 6) target += 20; // 対象艦No. 連合第二艦隊なら20の下駄履き.
				result.detail.push({ty: ty, at: at, target: target, si: si, cl: battle_cl_name(cl[j]), damage: battle.api_damage[i][j]});
			}
		}
	}
	if (battle.api_fdam) {
		// 航空戦/雷撃戦:味方ダメージ集計.
		for (var i = 1; i <= 6; ++i) {
			if (hc)
				hc[i] -= Math.floor(battle.api_fdam[i]);
			else
				hp[i] -= Math.floor(battle.api_fdam[i]);
		}
	}
	if (battle.api_edam) {
		// 航空戦/雷撃戦:敵ダメージ集計.
		for (var i = 1; i <= 6; ++i) {
			hp[i+6] -= Math.floor(battle.api_edam[i]);
		}
	}
	if (battle.api_deck_id && battle.api_damage) { // battle: api_support_hourai
		// 支援艦隊砲雷撃:敵ダメージ集計.
		for (var i = 1; i <= 6; ++i) {
			hp[i+6] -= Math.floor(battle.api_damage[i]);
		}
		// 支援艦隊砲雷撃:戦闘詳報収集.
		for (var i = 1; i <= 6; ++i) {
			result.detail.push({ty:"支援砲雷撃", target: i + 6, cl: battle_cl_name(battle.api_cl_list[i]), damage: battle.api_damage[i]});
		}
	}
	if (battle.api_frai) {
		// 味方雷撃:戦闘詳報収集.
		for (var i = 1; i <= 6; ++i) {
			var target = battle.api_frai[i];
			var damage = battle.api_fydam[i];
			if (target != 0) result.detail.push({ty:"雷撃戦", at: (hc ? i + 20 : i), target: target + 6, cl: battle_cl_name(battle.api_fcl[i]), damage: damage});
		}
	}
	if (battle.api_erai) {
		// 敵雷撃:戦闘詳報収集.
		for (var i = 1; i <= 6; ++i) {
			var target = battle.api_erai[i];
			var damage = battle.api_eydam[i];
			if (target != 0) result.detail.push({ty:"雷撃戦", at: i + 6, target: (hc ? target + 20 : target), cl: battle_cl_name(battle.api_ecl[i]), damage: damage});
		}
	}
	if (battle.api_frai_flag && battle.api_fbak_flag) {
		// 開幕航空戦:味方被害詳報収集.
		for (var i = 1; i <= 6; ++i) {
			var target = hc ? i + 20 : i;
			var damage = battle.api_fdam[i];
			if (battle.api_frai_flag[i] || battle.api_fbak_flag[i])
				result.detail.push({ty:"航空戦", target: target, cl: battle_cl_name(damage ? battle.api_fcl_flag[i]+1 : 0), damage: damage});
		}
	}
	if (battle.api_erai_flag && battle.api_ebak_flag) {
		// 開幕航空戦/航空支援:敵被害詳報収集.
		for (var i = 1; i <= 6; ++i) {
			var target = i + 6;
			var damage = battle.api_edam[i];
			if (battle.api_erai_flag[i] || battle.api_ebak_flag[i])
				result.detail.push({ty: (battle.api_fdam ? "航空戦" : "航空支援"), target: target, cl: battle_cl_name(damage ? battle.api_ecl_flag[i]+1 : 0), damage: damage});
		}
	}
}

function calc_kouku_damage(result, hp, kouku, hc) {
	if (!kouku) return;
	if (kouku.api_stage1) {	// 制空戦.
		var st = kouku.api_stage1;
		result.seiku = st.api_disp_seiku;
		result.touch = st.api_touch_plane;
		result.f_air_lostcount += st.api_f_lostcount;
		if (st.api_touch_plane) {
			var t0 = st.api_touch_plane[0]; if (t0 != -1) result.detail.push({ty:'触接',  si:[t0]});
			var t1 = st.api_touch_plane[1]; if (t1 != -1) result.detail.push({ty:'被触接', si:[t1]});
		}
		result.detail.push({
			ty: seiku_name(st.api_disp_seiku),
			ek: fraction_percent_name(st.api_e_lostcount, st.api_e_count),
			fk: fraction_percent_name(st.api_f_lostcount, st.api_f_count)
		});
	}
	if (kouku.api_stage2) {	// 防空戦.
		var st = kouku.api_stage2;
		result.f_air_lostcount += st.api_f_lostcount;
		if (st.api_air_fire) {
			var idx = st.api_air_fire.api_idx + 1; if ($combined_flag && idx > 6) idx += 20 - 6;
			result.detail.push({
				ty: '対空カットイン(' + st.api_air_fire.api_kind + ')',
				at: idx,
				si: st.api_air_fire.api_use_items,
				ek: fraction_percent_name(st.api_e_lostcount, st.api_e_count),
				fk: fraction_percent_name(st.api_f_lostcount, st.api_f_count)
			});
		}
		else {
			result.detail.push({
				ty: '防空戦',
				ek: fraction_percent_name(st.api_e_lostcount, st.api_e_count),
				fk: fraction_percent_name(st.api_f_lostcount, st.api_f_count)
			});
		}
	}
	calc_damage(result, hp, kouku.api_stage3);				// 航空爆撃雷撃戦.
	calc_damage(result, hp, kouku.api_stage3_combined, hc);	// 連合第二艦隊：航空爆撃雷撃戦.
}

function push_fdeck_status(req, fdeck, maxhps, nowhps, beginhps) {
	req.push(fdeck.api_name);
	for (var i = 1; i <= 6; ++i) {
		if (maxhps[i] == -1) continue;
		var name = '?';
		var ship = $ship_list[fdeck.api_ship[i-1]];
		if (ship) {
			name = ship.name_lv();
			if (nowhps[i] <= 0 && slotitem_use(ship.slot, [42, 43])) name += '!!修理発動';
			var repair = slotitem_count(ship.slot, 42);	// 修理要員(ダメコン).
			var megami = slotitem_count(ship.slot, 43);	// 修理女神.
			if (repair) name += '+修理要員x' + repair;
			if (megami) name += '+修理女神x' + megami;
		}
		req.push('\t' + i + '(' + name + ').\t' + hp_status_on_battle(nowhps[i], maxhps[i], beginhps[i]));
	}
}

function guess_win_rank(nowhps, maxhps, beginhps, nowhps_c, maxhps_c, beginhps_c, isChase) {
	// 友軍の轟沈／護衛退避には未対応.
	// 応急修理発動時の計算も不明.
	var f_damage_total = 0;
	var f_hp_total = 0;
	var f_maxhp_total = 0;
	var f_lost_count = 0;
	var f_count = 0;
	var e_damage_total = 0;
	var e_hp_total = 0;
	var e_count = 0;
	var e_lost_count = 0;
	var e_leader_lost = false;
	for (var i = 1; i <= 6; ++i) {
		// 友軍被害集計.
		if(maxhps[i] == -1) continue;
		var n = nowhps[i];
		++f_count;
		f_damage_total += beginhps[i] - Math.max(0, n);
		f_hp_total += beginhps[i];
		f_maxhp_total += maxhps[i];
		if (n <= 0) {
			++f_lost_count;
		}
	}
	for (var i = 1; i <= 6; ++i) {
		// 連合第二友軍被害集計.
		if(!maxhps_c || maxhps_c[i] == -1) continue;
		var n = nowhps_c[i];
		++f_count;
		f_damage_total += beginhps_c[i] - Math.max(0, n);
		f_hp_total += beginhps_c[i];
		f_maxhp_total += maxhps_c[i];
		if (n <= 0) {
			++f_lost_count;
		}
	}
	for(var i = 7; i <= 12; ++i){
		// 敵艦被害集計.
		if(maxhps[i] == -1) continue;
		var n = nowhps[i];
		++e_count;
		e_damage_total += beginhps[i] - Math.max(0, n);
		e_hp_total += beginhps[i];
		if (n <= 0) {
			++e_lost_count;
			if(i == 7) e_leader_lost = true;
		}
	}
	$f_damage = f_damage_total;
	// %%% CUT HERE FOR TEST %%%
	var f_damage_percent = Math.floor(100 * f_damage_total / f_hp_total); // 自ダメージ百分率. 小数点以下切り捨て.
	var e_damage_percent = Math.floor(100 * e_damage_total / e_hp_total); // 敵ダメージ百分率. 小数点以下切り捨て.
	var rate = e_damage_percent == 0 ? 0   : // 潜水艦お見合い等ではDになるので敵ダメ判定を優先する.
			   f_damage_percent == 0 ? 100 : // ゼロ除算回避、こちらが無傷なら1ダメ以上与えていればBなのでrateを100にする.
			   e_damage_percent / f_damage_percent;
	$guess_info_str = 'f_damage:' + fraction_percent_name(f_damage_total, f_hp_total) + '[' + f_lost_count + '/' + f_count + ']' + f_maxhp_total
				+ ', e_damage:' + fraction_percent_name(e_damage_total, e_hp_total) + (e_leader_lost ? '[x' : '[') + e_lost_count + '/' + e_count + ']'
				+ (isChase ? ', chase_rate:' : ', rate:') + Math.round(rate * 10000) / 10000
				;
	$guess_debug_log = false;
	if (e_count == e_lost_count && f_lost_count == 0) {
		return (f_damage_total == 0) ? '完S' : 'S';	// 1%未満の微ダメージでも、"完S"にはならない.
	}
	if (e_lost_count >= (e_count == 6 ? 4 : e_count/2) && f_lost_count == 0) {
		return 'A';
	}
	if (e_leader_lost && f_lost_count < e_lost_count) {
		return 'B';
	}
	$guess_debug_log = (rate >= 2.49 && rate <= 2.51) // B/C判定閾値検証.
				|| (f_damage_total != 0 && f_damage_percent == 0) // 自ダメージ 1%未満時.
				|| (e_damage_total != 0 && e_damage_percent == 0) // 敵ダメージ 1%未満時.
				;
	if (rate > 2.5) { // ほぼ確定. rate == 2.5 でC判定を確認済み.
		return 'B';
	}
	$guess_debug_log = (rate >= 0.8864 && rate <= 0.9038) // C/D判定閾値検証.
				|| (f_damage_total != 0 && f_damage_percent == 0) // 自ダメージ 1%未満時.
				|| (e_damage_total != 0 && e_damage_percent == 0) // 敵ダメージ 1%未満時.
				;
	if (rate > 0.9) { // 要検証!!! r == 0.9038 でC判定を確認. rate == 0.8864 でD判定を確認済み. 0.8864～0.9038 の区間に閾値がある.
		return 'C';
	}
	if (f_lost_count < f_count/2) { // 要検証.
		return 'D';
	}
	return 'E';
}

function on_battle(json) {
	var d = json.api_data;
	if (!d.api_maxhps || !d.api_nowhps) return;
	var maxhps = d.api_maxhps;				// 出撃艦隊[1..6] 敵艦隊[7..12]
	var nowhps = d.api_nowhps;				// 出撃艦隊[1..6] 敵艦隊[7..12]
	var maxhps_c = d.api_maxhps_combined;	// 連合第二艦隊[1..6].
	var nowhps_c = d.api_nowhps_combined;	// 連合第二艦隊[1..6].
	var beginhps = nowhps.concat();
	var beginhps_c = nowhps_c ? nowhps_c.concat() : [];
	var result = {
		seiku : null, 				// 制空権.
		touch : null,				// 触接.
		f_air_lostcount : 0,		// 非撃墜数.
		detail : []					// 戦闘詳報.
	};
	if (d.api_touch_plane) {
		// 触接(夜戦).
		result.touch = d.api_touch_plane;
		var t0 = d.api_touch_plane[0]; if (t0 != -1) result.detail.push({ty:'触接(夜戦)',  si:[t0]});
		var t1 = d.api_touch_plane[1]; if (t1 != -1) result.detail.push({ty:'被触接(夜戦)', si:[t1]});
	}
	if (d.api_flare_pos) {
		// 照明弾発射(夜戦).
		var t0 = d.api_flare_pos[0]; if (t0 != -1) result.detail.push({ty:'照明弾(夜戦)', at:t0});
		var t1 = d.api_flare_pos[1]; if (t1 != -1) result.detail.push({ty:'敵照明弾(夜戦)', at:t1+6});
	}
	calc_kouku_damage(result, nowhps, d.api_kouku, nowhps_c); // 航空戦.
	calc_kouku_damage(result, nowhps, d.api_kouku2, nowhps_c); // 航空戦第二波.
	var ds = d.api_support_info;
	if (ds) {
		if (ds.api_support_airatack) ds.api_support_airattack = ds.api_support_airatack; // 綴り訂正.
		if (d.api_support_flag == 1) calc_damage(result, nowhps, ds.api_support_airattack.api_stage3); // 1:航空支援.
		if (d.api_support_flag == 2) calc_damage(result, nowhps, ds.api_support_hourai); // 2:支援射撃
		if (d.api_support_flag == 3) calc_damage(result, nowhps, ds.api_support_hourai); // 3:支援長距離雷撃.
	}
	calc_damage(result, nowhps, d.api_opening_atack, nowhps_c);	// 開幕雷撃.
	calc_damage(result, nowhps, d.api_hougeki, nowhps_c);	// midnight
	switch ($combined_flag) {
	default:// 不明.
	case 0: // 通常艦隊.
		calc_damage(result, nowhps, d.api_hougeki1);	// 第一艦隊砲撃一巡目.
		calc_damage(result, nowhps, d.api_hougeki2);	// 第一艦隊砲撃二巡目.
		break;
	case 1: // 連合艦隊(機動部隊).
		calc_damage(result, nowhps, d.api_hougeki1, nowhps_c);	// 第二艦隊砲撃.
		calc_damage(result, nowhps, d.api_hougeki2);	// 第一艦隊砲撃一巡目.
		calc_damage(result, nowhps, d.api_hougeki3);	// 第一艦隊砲撃二巡目.
		break;
	case 2: // 連合艦隊(水上部隊).
		calc_damage(result, nowhps, d.api_hougeki1);	// 第一艦隊砲撃一巡目.
		calc_damage(result, nowhps, d.api_hougeki2);	// 第一艦隊砲撃二順目.
		calc_damage(result, nowhps, d.api_hougeki3, nowhps_c);	// 第二艦隊砲撃.
		break;
	}
	calc_damage(result, nowhps, d.api_raigeki, nowhps_c);
	if (!d.api_deck_id) d.api_deck_id = d.api_dock_id; // battleのデータは、綴りミスがあるので補正する.
	var fdeck = $fdeck_list[$battle_deck_id = d.api_deck_id];
	var fmt = null;
	if (d.api_formation) {
		fmt = formation_name(d.api_formation[0])
			+ '/' + match_name(d.api_formation[2])
			+ '/敵' + formation_name(d.api_formation[1]);
		if (d.api_support_flag) fmt += '+' + support_name(d.api_support_flag);
		$battle_info = fmt;
		$enemy_formation = formation_name(d.api_formation[1]);
	}
	if (!fdeck) return; // for debug.
	var req = [request_date_time()];
	req.push('# ' + ($next_mapinfo ? $next_mapinfo.api_name : '') + ' battle' + $battle_count);
	req.push($next_enemy);
	if (fmt) req.push(fmt);
	if (d.api_search) {
		req.push('索敵: ' + search_name(d.api_search[0])); // d.api_search[1] は敵索敵か??
	}
	if (result.touch) {
		var t0 = result.touch[0]; if (t0 != -1) req.push('触接中: ' + slotitem_name(t0));
		var t1 = result.touch[1]; if (t1 != -1) req.push('被触接中: ' + slotitem_name(t1));
	}
	if (result.seiku != null) {
		var s = seiku_name(result.seiku);
		req.push(s);
		$battle_info += '/' + s;
	}
	if ($beginhps) {
		req.push('緒戦被害:' + $guess_info_str + ', 推定:' + $guess_win_rank);
		$battle_info += '/追撃';
	}
	if (!$beginhps) $beginhps = beginhps;
	if (!$beginhps_c) $beginhps_c = beginhps_c;
	if (d.api_escape_idx) {
		d.api_escape_idx.forEach(function(idx) {
			maxhps[idx] = -1;	// 護衛退避した艦を艦隊リストから抜く. idx=1..6
		});
	}
	if (d.api_escape_idx_combined) {
		d.api_escape_idx_combined.forEach(function(idx) {
			maxhps_c[idx] = -1;	// 護衛退避した艦を第二艦隊リストから抜く. idx=1..6
		});
	}
	$guess_win_rank = guess_win_rank(nowhps, maxhps, $beginhps, nowhps_c, maxhps_c, $beginhps_c, $beginhps != beginhps)
	req.push('戦闘被害:' + $guess_info_str);
	req.push('勝敗推定:' + $guess_win_rank);

	function ship_name_lv(idx) {
		if (idx > 20) {
			idx -= 20; return '(艦隊2)' + $ship_list[$fdeck_list[2].api_ship[idx-1]].name_lv(); // 連合第二艦隊.
		}
		else if (idx > 6) {
			idx -= 6; return '(敵' + idx + ')' + ship_name(d.api_ship_ke[idx]) + 'Lv' + d.api_ship_lv[idx]; // 敵艦隊.
		}
		else if (idx >= 1) {
			return '(艦隊' + fdeck.api_id + ')' + $ship_list[fdeck.api_ship[idx-1]].name_lv(); // 味方艦隊.
		}
		else // NaN, undefined, null
			return '';
	}
	if (result.detail.length) {
		var msg = ['YPS_battle_detail', '\t==種別\t==攻撃艦\t==防御艦\t==敵撃墜/戦果\t==被撃墜/ダメージ\t==使用装備'];
		for (var i = 0; i < result.detail.length; ++i) {
			var dt = result.detail[i];
			msg.push('\t' + dt.ty
				+ '\t' + ship_name_lv(dt.at)
				+ '\t' + ship_name_lv(dt.target)
				+ '\t' + (dt.cl || dt.ek || "")	// 命中判定 または 敵撃墜率.
				+ '\t' + (dt.damage || dt.fk || "")	// ダメージ または 被撃墜率.
				+ '\t' + slotitem_names(dt.si)
			);
		}
		req.push('戦闘詳報');
		req.push(msg);
	}

	req.push('## friend damage');
	push_fdeck_status(req, fdeck, maxhps, nowhps, beginhps);
	req.push('被撃墜数: ' + result.f_air_lostcount);
	if (nowhps_c) {
		req.push('## friend(2nd) damage');
		push_fdeck_status(req, $fdeck_list[2], maxhps_c, nowhps_c, beginhps_c); // 連合第二艦隊は二番固定です.
	}
	req.push('## enemy damage');
	$enemy_ship_names = [];
	for (var i = 1; i <= 6; ++i) {
		var ke = d.api_ship_ke[i];
		if (ke == -1) continue;
		var name = ship_name(ke) + 'Lv' + d.api_ship_lv[i];
		$enemy_ship_names.push(name);
		req.push('\t' + i + '(' + name + ').\t' + hp_status_on_battle(nowhps[i+6], maxhps[i+6], beginhps[i+6]));
	}
	chrome.extension.sendRequest(req);
}

chrome.devtools.network.onRequestFinished.addListener(function (request) {
	var func = null;
	var api_name = request.request.url.replace(/^http:\/\/[^\/]+\/kcsapi\//, '/');
	if (api_name == request.request.url) {
		// 置換失敗. api以外なので早抜けする.
		return;
	}
	// 時刻を得る.
	$svDateTime = $pcDateTime = request.startedDateTime;	// PC側の日時(POST).
	var h = request.response.headers;
	if (h && h[0].name == 'Date') {
		$svDateTime = new Date(h[0].value);		// サーバ側の日時(RESP).
	}
	// API解析.
	if (api_name == '/api_start2') {
		// ゲーム開始時点.
		func = function(json) { // 艦種表を取り込む.
			update_mst_ship(json.api_data.api_mst_ship);
			update_mst_slotitem(json.api_data.api_mst_slotitem);
			update_mst_useitem(json.api_data.api_mst_useitem);
			update_mst_mission(json.api_data.api_mst_mission);
			update_mst_mapinfo(json.api_data.api_mst_mapinfo);
			chrome.extension.sendRequest("## ロード完了");
			// debug_print_mst();
			// debug_print_newship_slots();
		};
	}
	else if (api_name == '/api_get_member/slot_item') {
		// 保有装備一覧表.
		func = function(json) { // 保有する装備配列をリストに記録する.
			$slotitem_list = {};
			add_slotitem_list(json.api_data);
			save_storage('slotitem_list', $slotitem_list);
		};
	}
	else if (api_name == '/api_get_member/kdock') {
		// 建造一覧表(ログイン直後、建造直後).
		func = function(json) { // 建造状況を更新する.
			update_kdock_list(json.api_data);
		};
	}
	else if (api_name == '/api_req_kousyou/createship') {
		// 艦娘建造.
		var params = decode_postdata_params(request.request.postData.params); // 送信した消費資材値を抜き出す.
		$material.createship[0] -= params.api_item1;
		$material.createship[1] -= params.api_item2;
		$material.createship[2] -= params.api_item3;
		$material.createship[3] -= params.api_item4;
		$material.createship[6] -= params.api_item5;		// 開発資材(歯車).
		if (params.api_highspeed != 0) {
			$material.createship[4] -= (params.api_large_flag != 0 ? 10 : 1);	// 高速建造材(バーナー).
		}
		// 直後に /api_get_member/kdock と /api_get_member/material パケットが来るので print_port() は不要.
	}
	else if (api_name == '/api_req_kaisou/remodeling') {
		// 艦娘改造.
		var params = decode_postdata_params(request.request.postData.params);
		var ship = $ship_list[params.api_id];
		var mst = $mst_ship[ship.ship_id];
		$material.createship[1] -= mst.api_afterbull;	// 消費弾薬.
		$material.createship[2] -= mst.api_afterfuel;	// 消費鋼材. afterfuelという名前だが、消費するのは鋼材である.
		// 直後に /api_get_member/ship3, /api_get_member/slot_item, /api_get_member/material パケットが来るので print_port() は不要.
	}
	else if (api_name == '/api_req_kousyou/createitem') {
		// 装備開発.
		var params = decode_postdata_params(request.request.postData.params); // 送信した消費資材値を抜き出す.
		$material.createitem[0] -= params.api_item1;
		$material.createitem[1] -= params.api_item2;
		$material.createitem[2] -= params.api_item3;
		$material.createitem[3] -= params.api_item4;
		func = function(json) { // 開発成功した装備をリストに加える.
			var d = json.api_data;
			if (d.api_create_flag) {
				$material.createitem[6]--;	// 開発資材(歯車).
				add_slotitem_list(d.api_slot_item);
			}
			update_material(d.api_material);
			print_port();
		};
	}
	else if (api_name == '/api_req_kousyou/getship') {
		// 新艦建造成功.
		func = function(json) { // 建造艦が持つ初期装備配列を、リストに加える.
			update_kdock_list(json.api_data.api_kdock);
			delta_update_ship_list([json.api_data.api_ship]);
			add_slotitem_list(json.api_data.api_slotitem);
			print_port();
		};
	}
	else if (api_name == '/api_req_kousyou/destroyitem2') {
		// 装備破棄.
		func = function(json) {
			var ids = decode_postdata_params(request.request.postData.params).api_slotitem_ids;
			if (ids) slotitem_delete(/%2C/.test(ids) ? ids.split('%2C') : [ids]);		// 破棄した装備を、リストから抜く.
			diff_update_material(json.api_data.api_get_material, $material.destroyitem);	// 装備破棄による資材増加を記録する.
			print_port();
		};
	}
	else if (api_name == '/api_req_kousyou/destroyship') {
		// 艦娘解体.
		func = function(json) {
			var id = decode_postdata_params(request.request.postData.params).api_ship_id;
			if (id) ship_delete([id]);		// 解体した艦娘が持つ装備を、リストから抜く.
			update_material(json.api_data.api_material, $material.destroyship); /// 解体による資材増加を記録する. @bug 資材自然増加分が含まれてしまう.
			print_port();
		};
	}
	else if (api_name == '/api_req_kaisou/powerup') {
		// 近代化改修.
		var ids = decode_postdata_params(request.request.postData.params).api_id_items;
		if (ids) ship_delete(/%2C/.test(ids) ? ids.split('%2C') : [ids]);		// 素材として使った艦娘が持つ装備を、リストから抜く.
		func = function(json) {
			var d = json.api_data;
			if (d.api_ship) delta_update_ship_list([d.api_ship]);
			if (d.api_deck) update_fdeck_list(d.api_deck);
			print_port();
		}
	}
	else if (api_name == '/api_req_kousyou/remodel_slot') {
		// 装備改修.
		func = function(json) {	// 明石の改修工廠で改修した装備をリストに反映する.
			var d = json.api_data;
			add_slotitem_list(d.api_after_slot);	// 装備リストを更新する.
			slotitem_delete(d.api_use_slot_id);		// 改修で消費した装備を装備リストから抜く.
			update_material(d.api_after_material, $material.remodelslot);	/// 改修による資材消費を記録する. @bug 資材自然増加分が含まれてしまう.
			print_port();
		};
	}
	else if (api_name == '/api_req_kaisou/lock') {
		// 装備ロック.
		func = function(json) {
			var id = decode_postdata_params(request.request.postData.params).api_slotitem_id;	// ロック変更した装備ID.
			$slotitem_list[id].locked = json.api_data.api_locked;
			print_port();
		};
	}
	else if (api_name == '/api_req_hensei/change') {
		// 艦隊編成.
		var params = decode_postdata_params(request.request.postData.params);
		var list = $fdeck_list[params.api_id].api_ship;	// 変更艦隊リスト.
		var id  = params.api_ship_id;		// -2:一括解除, -1:解除, 他:艦娘ID.
		var idx = params.api_ship_idx;		// -1:一括解除, 0..N:変更位置.
		if (id == -2) {
			// 旗艦以外の艦を外す(-1を設定する).
			for (var i = 1; i < list.length; ++i) list[i] = -1;
		}
		else if (id == -1) {
			// 外す.
			list.splice(idx, 1);
			list.push(-1);
		}
		else { // id = 0..N
			find: for (var f_id in $fdeck_list) {
				// 艦娘IDの元の所属位置を old_list[old_idx] に得る.
				var old_list = $fdeck_list[f_id].api_ship;
				for (var old_idx = 0; old_idx < old_list.length; ++old_idx) {
					if (old_list[old_idx] == id) break find;
				}
			}
			if (old_list[old_idx] == id) {
				// 位置交換.
				old_list[old_idx] = list[idx];
				list[idx] = id;
				// 元位置が空席になったら前詰めする.
				if (old_list[old_idx] == -1) {
					old_list.splice(old_idx, 1);
					old_list.push(-1);
				}
			}
			else {
				// 新規追加.
				list[idx] = id;
			}
		}
		update_fdeck_list($fdeck_list); // 編成結果を $ship_fdeck に反映する.
		print_port();
	}
	else if (api_name == '/api_get_member/questlist') {
		// 任務一覧.
		func = function(json) { // 任務総数と任務リストを記録する.
			var list = json.api_data.api_list;
			$quest_count = json.api_data.api_count;
			$quest_exec_count = json.api_data.api_exec_count;
			if (json.api_data.api_disp_page == 1 && $quest_count != Object.keys($quest_list).length) {
				$quest_list = {}; // 任務総数が変わったらリストをクリアする.
			}
			if (list) list.forEach(function(data) {
				if (data == -1) return; // 最終ページには埋草で-1 が入っているので除外する.
				$quest_list[data.api_no] = data;
				if (data.api_no == 214) {
					get_weekly().quest_state = data.api_state; // あ号任務ならば、遂行状態を記録する(1:未遂行, 2:遂行中, 3:達成)
				}
			});
			print_port();
		};
	}
	else if (api_name == '/api_req_hokyu/charge') {
		// 補給実施.
		func = function(json) { // 補給による資材消費を記録する.
			var d = json.api_data;
			for (var i = 0; i < d.api_ship.length; ++i) {
				var data = d.api_ship[i];
				var ship = $ship_list[data.api_id];
				if (ship) ship.charge(data);
			}
			var now_baux = d.api_material[3];
			if (d.api_use_bou) $material.charge[3] -= $material.now[3] - now_baux;
			update_material(d.api_material);
			print_port();
		};
	}
	else if (api_name == '/api_req_quest/clearitemget') {
		// 任務クリア.
		var params = decode_postdata_params(request.request.postData.params);
		delete $quest_list[params.api_quest_id]; // 任務リストから外す.
		$quest_exec_count--;
		$quest_count--;
		func = function(json) { // 任務報酬を記録する.
			var d = json.api_data;
			for (var i = 0; i < d.api_material.length; ++i) {
				$material.quest[i] += d.api_material[i];
			}
			for (var i = 0; i < d.api_bounus.length; ++i) {
				var n  = d.api_bounus[i].api_count;
				var id = d.api_bounus[i].api_item.api_id;
				if (id >= 1 && id <= 8) $material.quest[id-1] += n;
			}
			// 直後に /api_get_member/material パケットが来るので print_port() は不要.
		};
	}
	else if (api_name == '/api_get_member/material') {
		// 建造後、任務クリア後など.
		func = function(json) { // 資材変化を記録する.
			update_material(json.api_data);
			print_port();
		};
	}
	else if (api_name == '/api_get_member/ndock') {
		// 入渠.
		func = function(json) { // 入渠状況を更新する.
			update_ndock_complete();
			update_ndock_list(json.api_data);
			if ($do_print_port_on_ndock) {
				$do_print_port_on_ndock = false;
				print_port();
			}
			else {
				on_mission_check(5);
			}
		};
	}
	else if (api_name == '/api_req_nyukyo/start') {
		// 入渠実施.
		var params = decode_postdata_params(request.request.postData.params);
		var ship = $ship_list[params.api_ship_id];
		var now = $material.now.concat();
		now[0] -= ship.ndock_item[0];	// 燃料.
		now[2] -= ship.ndock_item[1];	// 鋼材.
		now[5] -= params.api_highspeed;	// 高速修復材(バケツ). "0" or "1".
		update_material(now, $material.ndock);
		if (params.api_highspeed != 0) {
			ship.highspeed_repair();	// 母港パケットで一斉更新されるまで対象艦の修復完了が反映されないので、自前で反映する.
			print_port();	// 高速修復を使った場合は /api_get_member/ndock パケットが来ないので、ここで print_port() を行う.
		}
		else {
			$do_print_port_on_ndock = true; // 直後に来る /api_get_member/ndock パケットで print_port() を行う.
		}
	}
	else if (api_name == '/api_req_nyukyo/speedchange') {
		// 入渠中の高速修復実施.
		var params = decode_postdata_params(request.request.postData.params);
		for (var ship_id in $ndock_list) {
			if ($ndock_list[ship_id].api_id == params.api_ndock_id) {
				$ship_list[ship_id].highspeed_repair(); break;	// 母港パケットで一斉更新されるまで対象艦の修復完了が反映されないので、自前で反映する.
			}
		}
		var now = $material.now.concat();
		--now[5];	// 高速修復材(バケツ).
		update_material(now, $material.ndock);
		print_port();
	}
	else if (api_name == '/api_req_kousyou/createship_speedchange') {
		// 建造中の高速建造実施.
		var params = decode_postdata_params(request.request.postData.params);
		var k = $kdock_list[params.api_kdock_id];
		if (k) k.api_state = 3; // 完成に変更する.
		var now = $material.now.concat();
		now[4] -= (k.api_item1 >= 1500 ? 10 : 1);	// 高速建造材(バーナー).
		update_material(now, $material.createship);
		print_port();
	}
	else if (api_name == '/api_port/port') {
		// 母港帰還.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			update_ship_list(json.api_data.api_ship);
			update_fdeck_list(json.api_data.api_deck_port);
			update_ndock_list(json.api_data.api_ndock);
			if ($battle_deck_id > 0) $last_mission[$battle_deck_id] = '前回出撃: ' + $battle_log.join('\n→');
			$battle_deck_id = -1;
			$ship_escape = {};
			$combined_flag = json.api_data.api_combined_flag;	// 連合艦隊編成有無.
			update_material(json.api_data.api_material);		// 資材を更新する.
			var basic = json.api_data.api_basic;
			$max_ship     = basic.api_max_chara;
			$max_slotitem = basic.api_max_slotitem + 3;
			print_port();
		};
	}
	else if (api_name == '/api_get_member/ship_deck') {
		// 進撃. 2015-5-18メンテにて、ship2が廃止されて置き換わった.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			delta_update_ship_list(json.api_data.api_ship_data);
			delta_update_fdeck_list(json.api_data.api_deck_data);
			print_port();
		};
	}
	else if (api_name == '/api_get_member/ship3') {
		// 装備換装、艦娘改造.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			if (decode_postdata_params(request.request.postData.params).api_shipid)
				delta_update_ship_list(json.api_data.api_ship_data); // 装備解除時は差分のみ.
			else
				update_ship_list(json.api_data.api_ship_data);
			update_fdeck_list(json.api_data.api_deck_data);
			print_port();
		};
	}
	else if (api_name == '/api_get_member/mission') {
		// 遠征メニュー.
		func = function(json) { // 遠征任務の受諾をチェックする.
			on_mission_check(4);
		};
	}
	else if (api_name == '/api_get_member/deck') {
		// 遠征出発.
		func = function(json) { // 艦隊一覧を更新してcond表示する.
			update_fdeck_list(json.api_data);
			print_port();
		};
	}
	else if (api_name == '/api_req_mission/result') {
		// 遠征結果.
		func = function(json) { // 成功状況を記録する.
			var d = json.api_data;
			var id = decode_postdata_params(request.request.postData.params).api_deck_id;
			$last_mission[id] = '前回遠征: ' + d.api_quest_name + ' ' + mission_clear_name(d.api_clear_result);
			for (var i = 0; i < d.api_get_material.length; ++i) // i=0..3 燃料からボーキーまで.
				$material.mission[i] += d.api_get_material[i];
			var add_mission_item = function(flag, get_item) {
				var id = 0;
				switch (flag) {
				case 1: id = 6; break; // バケツ.
				case 2: id = 5; break; // バーナー.
				case 3: id = 7; break; // 歯車.
				case 4: id = get_item.api_useitem_id; break; // その他のアイテム.
				}
				if (id >= 1 && id <= 8 && get_item) $material.mission[id-1] += get_item.api_useitem_count;
			};
			add_mission_item(d.api_useitem_flag[0], d.api_get_item1);
			add_mission_item(d.api_useitem_flag[1], d.api_get_item2);
			// 直後に /api_port/port パケットが来るので print_port() は不要.
		};
	}
	else if (api_name == '/api_get_member/practice') {
		// 演習メニュー.
		func = function(json) { // 演習任務の受諾をチェックする.
			on_mission_check(3);
		};
	}
	else if (api_name == '/api_req_member/get_practice_enemyinfo') {
		// 演習相手の情報.
		func = function(json) { // 演習相手の提督名を記憶する.
			$next_enemy = "演習相手:" + json.api_data.api_nickname;
			$next_mapinfo = { api_name : "演習" };
		};
	}
	else if (api_name == '/api_get_member/mapinfo') {
		// 海域選択メニュー.
		func = function(json) { // 海域情報を記録する.
			$mapinfo_rank = {};
			json.api_data.forEach(function(data) {
				if (data.api_eventmap)
					$mapinfo_rank[data.api_id] = data.api_eventmap.api_selected_rank;
			});
		};
	}
	else if (api_name == '/api_req_map/start') {
		// 海域初回選択.
		$battle_count = 0;
		$battle_log = [];
		var w = get_weekly();
		if (w.quest_state == 2) w.sortie++;
		$is_boss = false;
		func = on_next_cell;
	}
	else if (api_name == '/api_req_map/next') {
		// 海域次選択.
		func = on_next_cell;
	}
	else if (api_name == '/api_req_sortie/battle'
		|| api_name == '/api_req_sortie/airbattle'
		|| api_name == '/api_req_combined_battle/battle'
		|| api_name == '/api_req_combined_battle/battle_water'
		|| api_name == '/api_req_combined_battle/airbattle') {
		// 昼戦開始.
		$battle_count++;
		$beginhps = null;
		$beginhps_c = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_battle_midnight/battle'
		|| api_name == '/api_req_combined_battle/midnight_battle') {
		// 昼戦→夜戦追撃.
		func = on_battle;
	}
	else if (api_name == '/api_req_battle_midnight/sp_midnight'
		|| api_name == '/api_req_combined_battle/sp_midnight') {
		// 夜戦開始.
		$battle_count++;
		$beginhps = null;
		$beginhps_c = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_sortie/night_to_day') {
		// 夜戦→昼戦追撃.
		func = on_battle;
	}
	else if (api_name == '/api_req_practice/battle') {
		// 演習開始.
		$battle_count = 1;
		$beginhps = null;
		$beginhps_c = null;
		$battle_log = [];
		func = on_battle;
	}
	else if (api_name == '/api_req_practice/midnight_battle') {
		// 夜演習継続.
		func = on_battle;
	}
	else if (api_name == '/api_req_sortie/battleresult'
		|| api_name == '/api_req_combined_battle/battleresult') {
		// 戦闘結果.
		func = function(json) {
			on_battle_result(json);
			var r = json.api_data.api_win_rank;
			var w = get_weekly();
			if (w.quest_state != 2) return; // 遂行中以外は更新しない.
			if (r == 'S') w.win_S++;
			if($is_boss) {
				w.boss_cell++;
				if (r == 'S' || r == 'A' || r == 'B') w.win_boss++;
			}
			save_weekly();
		};
	}
	else if (api_name == '/api_req_practice/battle_result') {
		// 演習結果.
		func = on_battle_result;
	}
	else if (api_name == '/api_req_combined_battle/goback_port') {
		// 護衛退避.
		on_goback_port();
	}
	if (!func) return;
	request.getContent(function (content) {
		if (!content) return;
		var json = JSON.parse(content.replace(/^svdata=/, ''));
		if (!json || !json.api_data) return;
		func(json);
	});
});
