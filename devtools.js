// -*- coding: utf-8 -*-
var $ship_list		= load_storage('ship_list');
var $enemy_list		= load_storage('enemy_list');
var $mst_ship		= load_storage('mst_ship');
var $mst_slotitem	= load_storage('mst_slotitem');
var $mst_mission	= load_storage('mst_mission');
var $mst_useitem	= load_storage('mst_useitem');
var $mst_mapinfo	= load_storage('mst_mapinfo');
var $weekly			= load_storage('weekly');
var $logbook		= load_storage('logbook', []);
var $slotitem_list = {};
var $max_ship = 0;
var $max_slotitem = 0;
var $combined_flag = 0;
var $fdeck_list = {};
var $ship_fdeck = {};
var $ship_escape = {};	// 護衛退避したshipidのマップ.
var $next_mapinfo = null;
var $next_enemy = null;
var $is_boss = false;
var $material = {};
var $quest_count = 0;
var $quest_exec_count = 0;
var $quest_list = {};
var $battle_count = 0;
var $ndock_list = {};
var $kdock_list = {};
var $enemy_id = null;
var $enemy_formation_id = 0;
var $battle_log = [];
var $last_mission = {};
var $beginhps = null;
var $beginhps_c = null;
var $f_damage = 0;
var $guess_win_rank = '?';
var $guess_info_str = '';

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
	this.ship_id	= data.api_ship_id;
	this.kyouka	= data.api_kyouka;	// 近代化改修による強化値[火力,雷装,対空,装甲,運].
}

Ship.prototype.name_lv = function() {
	return ship_name(this.ship_id) + 'Lv' + this.lv;
};

Ship.prototype.kira_cond_diff_name = function() {
	return kira_name(this.c_cond) + this.c_cond + diff_name(this.c_cond, this.p_cond);
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
}

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

function update_ship_list(list, is_all) {
	if (!list) return;
	// update ship_list
	var prev_ship_list = $ship_list;
	if (is_all) $ship_list = {};
	list.forEach(function(data) {
		$ship_list[data.api_id] = new Ship(data, prev_ship_list[data.api_id]);
		if (is_all) {
			data.api_slot.forEach(function(id) {
				// 未知の装備があれば、ダミーエントリを作って数を合わせる. 戦闘直後のship2にて、ドロップ艦がこの状況となる.
				if (id != -1 && !$slotitem_list[id]) $slotitem_list[id] = { item_id: -1, locked: 0, level: 0 };
			});
		}
	});
	save_storage('ship_list', $ship_list);
}

function update_enemy_list() {
	save_storage('enemy_list', $enemy_list);
}

function update_fdeck_list(list) {
	if (!list) return;
	$fdeck_list = {};
	$ship_fdeck = {};
	list.forEach(function(deck) {
		$fdeck_list[deck.api_id] = deck;
		for (var i in deck.api_ship) {
			var ship_id = deck.api_ship[i];
			if (ship_id != -1) $ship_fdeck[ship_id] = deck.api_id;
		}
	});
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

function fraction_name(num, denom) {
	if (num >= denom)
		return '達成';
	else
		return num + '/' + denom;
}

//------------------------------------------------------------------------
// 表示文字列化.
//
function weekly_name() {
	var w = get_weekly();
	return '(出撃数:'  + fraction_name(w.sortie, 36)
		+ ', ボス勝利:' + fraction_name(w.win_boss, 12)
		+ ', ボス到達:' + fraction_name(w.boss_cell, 24)
		+ ', S勝利:'   + fraction_name(w.win_S, 6)
		+ ')';
}

function diff_name(now, prev) {		// now:1, prev:2 -> "(-1)"
	var diff = now - prev;
	if (!prev) return '';
	else if (diff > 0) return '(+' + diff + ')'; // with plus sign
	else if (diff < 0) return '(' + diff +')';   // with minus sign
	else /* diff == 0 */ return '';
}

function percent_name(now, max) {	// now:1, prev:2 -> "50%"
	if (!max) return '';
	return Math.floor(100 * now / max) + '%';
}

function percent_name_unless100(now, max) {	// now:1, max:2 -> "(50%)"
	if (!max || now == max) return '';
	return '(' + percent_name(now, max) + ')';
}

function fraction_percent_name(now, max) {	// now:1, max:2 -> "1/2(50%)"
	return now + '/' + max + '(' + percent_name(now, max) + ')';
}

function kira_name(cond) {
	return (cond >= 85) ? '*** ' : // 三重キラ.
		   (cond >= 53) ? '** ' : // 回避向上キラ.
		   (cond >  49) ? '* ' : // キラ.
		   (cond == 49) ? '. ' : // normal
		 /* cond < 49 */  '> '; // recovering
};

function material_name(id) {
	switch (id) {
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
	var a = idlist.map(function(id) {
		return slotitem_name(id);
	});
	return a.join();
}

function ship_name(id) {
	var ship = $mst_ship[id];
	if (ship) {
		id = ship.api_name;
		if (ship.api_sortno == 0 && ship.api_yomi.length > 1) {
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

//------------------------------------------------------------------------
// データ解析.
//
function decode_postdata_params(params) {
	var r = {};
	if (!params) return;
	params.forEach(function(data) {
		var name  = decodeURI(data.name);
		var value = decodeURI(data.value);
		if (name && value) r[name] = value;
	});
	return r;
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

//------------------------------------------------------------------------
// イベントハンドラ.
//
function on_port(json) {
	var req = [];
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
	// 艦娘と装備数を検出する.
	var basic = json.api_data.api_basic;
	if (basic) {
		$max_ship     = basic.api_max_chara;
		$max_slotitem = basic.api_max_slotitem + 3;
		$combined_flag = json.api_data.api_combined_flag;
	}
	//
	// 資材変化を表示する.
	var material = json.api_data.api_material;
	var msg = [];
	if (material) {
		material.forEach(function(data) {
			var id = data.api_id;
			var value = data.api_value;
			var diff  = diff_name(value, $material[id]);
			$material[id] = value;
			if (diff.length) msg.push(material_name(id) + diff);
		});
	}
	req.push('資材増減数:' + msg.join(', '));
	//
	// 艦娘保有数、未ロック艦一覧、改造可能艦一覧、ロック艦キラ付一覧を表示する.
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
		+ ', キラ付:***' + cond85 + ' **' + cond53 + ' *' + cond50 + ')');
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
	// 入渠(修理)一覧表示する.
	var ndocks = Object.keys($ndock_list).length;
	var repairs = lock_repairlist.length;
	if (ndocks > 0 || repairs > 0) {
		var msg = ['YPS_ndock_list'];
		if (ndocks > 0) {
			msg.push('## 修理中');
			msg.push('\t==艦名Lv\t==燃料\t==弾薬\t==鋼材\t==ボーキ\t==完了時刻'); // 表ヘッダ.
			for (var id in $ndock_list) {
				var d = $ndock_list[id];
				var ship = $ship_list[id];
				var c_date = new Date(d.api_complete_time);
				msg.push('\t' + ship.name_lv() 
					+ '\t' + d.api_item1
					+ '\t' + d.api_item2
					+ '\t' + d.api_item3
					+ '\t' + d.api_item4
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
				+ '\t' + k.api_item1
				+ '\t' + k.api_item2
				+ '\t' + k.api_item3
				+ '\t' + k.api_item4
				+ '\t' + k.api_item5
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
		msg.push('\t==cond\t==艦名Lv\t==hp\t==修理\t==燃料\t==弾薬\t==装備'); // 表ヘッダ. 慣れれば不用な気がする.
		var deck = $fdeck_list[f_id];
		if ($combined_flag && f_id == 1) {
			var deck2 = $fdeck_list[2];	// 連合第二艦隊は2固定.
			push_fleet_status(msg, deck);
			push_fleet_status(msg, deck2);
			req.push('## 連合艦隊1+2: ' + deck.api_name + ' + ' + deck2.api_name);
		}
		else if ($combined_flag && f_id == 2) {
			continue;	// f_id == 1 にてまとめて表示済み.
		}
		else {
			push_fleet_status(msg, deck);
			req.push('## 艦隊' + f_id + ': ' + deck.api_name);
		}
		req.push(msg);
		var mission_end = deck.api_mission[2];
		if (mission_end > 0) {
			var d = new Date(mission_end);
			var id = deck.api_mission[1];
			req.push('遠征' + id + ' ' + $mst_mission[id].api_name + ': ' + d.toLocaleString());
		}
		else if (deck.api_id == $battle_deck_id) {
			req.push('出撃中: ' + $battle_log.join(' →') + ' →');
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
	var n = Object.keys($quest_list).length;
	if (n == 0) req.push('### 任務なし!!');
	else if (n != $quest_count) req.push('### 任務リストを先頭から最終ページまでめくってください');
	if (req.length > 1) chrome.extension.sendRequest(req);
}

function on_next_cell(json) {
	var d = json.api_data;
	var e = json.api_data.api_enemy;
	var g = json.api_data.api_itemget;
	var h = json.api_data.api_happening;
	var area = d.api_maparea_id + '-' + d.api_mapinfo_no + '-' + d.api_no;
	$next_mapinfo = $mst_mapinfo[d.api_maparea_id * 10 + d.api_mapinfo_no];
	if (e) {
		$enemy_id = e.api_enemy_id;
		var msg = $enemy_id.toString(10);
		var fleet = $enemy_list[$enemy_id];
		if (d.api_event_id == 5) {
			area += '(boss)';
			$is_boss = true;
			// 1-6 対策：戦闘のないボスマス.
			var w = get_weekly();
			if(w.quest_state == 2) {
				w.boss_cell++;
				save_weekly();
			}
		}
		$next_enemy = area + ':' + $enemy_id;
		if (fleet) {
			msg += '\n\t' + fleet.join('\t');
			if(/潜水.級/.test(msg)) msg += '\n### 潜水艦注意!!';
		}
		chrome.extension.sendRequest('## next enemy\n' + area + ':' + msg);
	}
	if (g) {
		var msg = material_name(g.api_id) + 'x' + g.api_getcount;
		chrome.extension.sendRequest('## next item\n' + area + ':' + msg);
	}
	if (h) {
		var msg = material_name(h.api_mst_id) + 'x' + h.api_count;
		if (h.api_dentan) msg += '(電探により軽減あり)';
		chrome.extension.sendRequest('## next loss\n' + area + ':' + msg);
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
		}
		if (/[BCDE]/.test(rank))	///@debug B勝利以下のみ記録する.
			push_to_logbook($next_enemy + ', ' + $guess_info_str);
		var fleet = $enemy_list[$enemy_id];
		if (fleet) {
			fleet[0] = e.api_deck_name + '(' + formation_name($enemy_formation_id) + '):';
			update_enemy_list();
		}
		var log = $next_enemy + '(' + e.api_deck_name + '):' + rank;
		if (drop_ship_name) {
			log += '+' + g.api_ship_name; // drop_ship_name; 艦種を付けると冗長すぎるので艦名のみとする.
		}
		if (drop_item_name) {
			log += '+' + drop_item_name;
		}
		$battle_log.push(log);
		$last_mission[$battle_deck_id] = '前回出撃: ' + $battle_log.join(' →');
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

function calc_damage(hp, battle, hc) {
	// hp ::= [-1, friend1...6, enemy1...6]
	// hc ::= [-1, combined1..6]
	if (!battle) return;
	if (battle.api_df_list && battle.api_damage) {
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
	}
	if (battle.api_fdam) {
		for (var i = 1; i <= 6; ++i) {
			if (hc)
				hc[i] -= Math.floor(battle.api_fdam[i]);
			else
				hp[i] -= Math.floor(battle.api_fdam[i]);
		}
	}
	if (battle.api_edam) {
		for (var i = 1; i <= 6; ++i) {
			hp[i+6] -= Math.floor(battle.api_edam[i]);
		}
	}
	if (battle.api_deck_id && battle.api_damage) { // battle: api_support_hourai
		for (var i = 1; i <= 6; ++i) {
			hp[i+6] -= Math.floor(battle.api_damage[i]);
		}
	}
}

function calc_kouku_damage(airplane, hp, kouku, hc) {
	if (!kouku) return;
	if (kouku.api_stage1) {	// 制空戦.
		airplane.seiku = kouku.api_stage1.api_disp_seiku;
		airplane.touch = kouku.api_stage1.api_touch_plane;
		airplane.f_lostcount += kouku.api_stage1.api_f_lostcount;
	}
	if (kouku.api_stage2) {	// 防空戦.
		airplane.f_lostcount += kouku.api_stage2.api_f_lostcount;
		if (kouku.api_stage2.api_air_fire) {
			airplane.air_fire = kouku.api_stage2.api_air_fire;
		}
	}
	calc_damage(hp, kouku.api_stage3);				// 航空爆撃雷撃戦.
	calc_damage(hp, kouku.api_stage3_combined, hc);	// 連合第二艦隊：航空爆撃雷撃戦.
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
	var f_damage_percent = Math.floor(100 * f_damage_total / f_hp_total); // 敵ダメージ百分率. 小数点以下切り捨て.
	var e_damage_percent = Math.floor(100 * e_damage_total / e_hp_total); // 自ダメージ百分率. 小数点以下切り捨て.
	var rate = e_damage_percent == 0 ? 0   : // 潜水艦お見合い等ではDになるので敵ダメ判定を優先する.
			   f_damage_percent == 0 ? 100 : // ゼロ除算回避、こちらが無傷なら1ダメ以上与えていればBなのでrateを100にする.
			   e_damage_percent / f_damage_percent;
	$guess_info_str = 'f_damage:' + fraction_percent_name(f_damage_total, f_hp_total) + '[' + f_lost_count + '/' + f_count + ']' + f_maxhp_total
				+ ', e_damage:' + fraction_percent_name(e_damage_total, e_hp_total) + (e_leader_lost ? '[x' : '[') + e_lost_count + '/' + e_count + ']'
				+ (isChase ? ', chase_rate:' : ', rate:') + Math.round(rate * 10000) / 10000
				;
	if (e_count == e_lost_count && f_lost_count == 0) {
		return (f_damage_total == 0) ? '完S' : 'S';
	}
	if (e_lost_count >= (e_count == 6 ? 4 : e_count/2) && f_lost_count == 0) {
		return 'A';
	}
	if (e_leader_lost && f_lost_count < e_lost_count) {
		return 'B';
	}
	if (rate > 2.5) { // ほぼ確定. rate == 2.5 でC判定を確認済み.
		return 'B';
	}
	if (rate > 0.9) { // 要検証!!! r == 0.958 でC判定を確認. rate == 0.8169 でD判定を確認済み. 0.817～0.957 の区間に閾値がある. 
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
	var airplane = {
		seiku : null, 				// 制空権.
		touch : d.api_touch_plane,	// 触接. 夜戦はd.にある、昼戦はd.api_kouku.state1.にある.
		f_lostcount : 0,			// 非撃墜数.
		air_fire : null				// 対空カットイン.
	};
	calc_kouku_damage(airplane, nowhps, d.api_kouku, nowhps_c); // 航空戦.
	calc_kouku_damage(airplane, nowhps, d.api_kouku2, nowhps_c); // 航空戦第二波.
	calc_damage(nowhps, d.api_opening_atack, nowhps_c);	// 開幕雷撃.
	calc_damage(nowhps, d.api_hougeki, nowhps_c);	// midnight
	switch ($combined_flag) {
	default:// 不明.
	case 0: // 通常艦隊.
		calc_damage(nowhps, d.api_hougeki1);	// 第一艦隊砲撃一巡目.
		calc_damage(nowhps, d.api_hougeki2);	// 第一艦隊砲撃二巡目.
		break;
	case 1: // 連合艦隊(機動部隊).
		calc_damage(nowhps, d.api_hougeki1, nowhps_c);	// 第二艦隊砲撃.
		calc_damage(nowhps, d.api_hougeki2);	// 第一艦隊砲撃一巡目.
		calc_damage(nowhps, d.api_hougeki3);	// 第一艦隊砲撃二巡目.
		break;
	case 2: // 連合艦隊(水上部隊).
		calc_damage(nowhps, d.api_hougeki1);	// 第一艦隊砲撃一巡目.
		calc_damage(nowhps, d.api_hougeki2);	// 第一艦隊砲撃二順目.
		calc_damage(nowhps, d.api_hougeki3, nowhps_c);	// 第二艦隊砲撃.
		break;
	}
	calc_damage(nowhps, d.api_raigeki, nowhps_c);
	if (d.api_support_flag == 1) calc_damage(nowhps, d.api_support_info.api_support_airattack.api_stage3); // 1:航空支援.
	if (d.api_support_flag == 2) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 2:支援射撃
	if (d.api_support_flag == 3) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 3:支援長距離雷撃.
	if (!d.api_deck_id) d.api_deck_id = d.api_dock_id; // battleのデータは、綴りミスがあるので補正する.
	var fdeck = $fdeck_list[d.api_deck_id];
	$battle_deck_id = fdeck.api_id;
	var fmt = null;
	if (d.api_formation) {
		$enemy_formation_id = d.api_formation[1];
		fmt = formation_name(d.api_formation[0]) + '/'
			+ match_name(d.api_formation[2]) + '/'
			+ formation_name(d.api_formation[1]);
		if (d.api_support_flag) fmt += '+' + support_name(d.api_support_flag);
	}
	var req = [];
	req.push('# ' + ($next_mapinfo ? $next_mapinfo.api_name : '') + ' battle' + $battle_count);
	req.push($next_enemy);
	if (fmt) req.push(fmt);
	if (d.api_search) {
		req.push('索敵: ' + search_name(d.api_search[0])); // d.api_search[1] は敵索敵か??
	}
	if (airplane.touch) {
		var t0 = airplane.touch[0]; if (t0 != -1) req.push('触接中: ' + slotitem_name(t0));
		var t1 = airplane.touch[1]; if (t1 != -1) req.push('被触接中: ' + slotitem_name(t1));
	}
	if (airplane.seiku != null) req.push(seiku_name(airplane.seiku));
	if (airplane.air_fire != null) {
		var air_fire = airplane.air_fire;
		var idx = air_fire.api_idx;
		var api_ship = 0;
		if ($combined_flag && idx >= 6) {
			api_ship = $fdeck_list[2].api_ship[idx - 6]; // 連合第二艦隊決め打ち
		} else {
			api_ship = fdeck.api_ship[idx];
		}
		var ship = $ship_list[api_ship];
		req.push('対空カットイン(' + air_fire.api_kind + '): ' + ship.name_lv() + '[' + slotitem_names(air_fire.api_use_items) + ']');
	}

	if ($beginhps) req.push('緒戦被害:' + $guess_info_str + ', 推定:' + $guess_win_rank);
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

	req.push('## friend damage');
	push_fdeck_status(req, fdeck, maxhps, nowhps, beginhps);
	req.push('被撃墜数: ' + airplane.f_lostcount);
	if (nowhps_c) {
		req.push('## friend(2nd) damage');
		push_fdeck_status(req, $fdeck_list[2], maxhps_c, nowhps_c, beginhps_c); // 連合第二艦隊は二番固定です.
	}
	req.push('## enemy damage');
	var enemy_fleet = [$enemy_list[$enemy_id] ? $enemy_list[$enemy_id][0] : '???'];
	for (var i = 1; i <= 6; ++i) {
		var ke = d.api_ship_ke[i];
		if (ke == -1) continue;
		var name = ship_name(ke) + 'Lv' + d.api_ship_lv[i];
		req.push('\t' + i + '(' + name + ').\t' + hp_status_on_battle(nowhps[i+6], maxhps[i+6], beginhps[i+6]));
		enemy_fleet.push(name);
	}
	if ($enemy_id) { // 演習は$enemy_idが空
		$enemy_list[$enemy_id] = enemy_fleet;
		update_enemy_list();
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
	else if (api_name == '/api_start2') {
		// ゲーム開始時点.
		func = function(json) { // 艦種表を取り込む.
			update_mst_ship(json.api_data.api_mst_ship);
			update_mst_slotitem(json.api_data.api_mst_slotitem);
			update_mst_useitem(json.api_data.api_mst_useitem);
			update_mst_mission(json.api_data.api_mst_mission);
			update_mst_mapinfo(json.api_data.api_mst_mapinfo);
			chrome.extension.sendRequest("## ロード完了");
			// debug_print_mst();
		};
	}
	else if (api_name == '/api_get_member/slot_item') {
		// 保有装備一覧表.
		func = function(json) { // 保有する装備配列をリストに記録する.
			$slotitem_list = {};
			add_slotitem_list(json.api_data);
		};
	}
	else if (api_name == '/api_get_member/kdock') {
		// 建造一覧表(ログイン直後、建造直後).
		func = function(json) { // 建造状況を更新する.
			update_kdock_list(json.api_data);
		};
	}
	else if (api_name == '/api_req_kousyou/createitem') {
		// 装備開発.
		func = function(json) { // 開発した装備を、リストに加える.
			if (json.api_data.api_create_flag) {
				add_slotitem_list(json.api_data.api_slot_item);
				on_port(json);
			}
		};
	}
	else if (api_name == '/api_req_kousyou/getship') {
		// 新艦建造成功.
		func = function(json) { // 建造艦が持つ初期装備配列を、リストに加える.
			update_kdock_list(json.api_data.api_kdock);
			update_ship_list([json.api_data.api_ship], false);
			add_slotitem_list(json.api_data.api_slotitem);
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kousyou/destroyitem2') {
		// 装備破棄.
		func = function(json) { // 破棄した装備を、リストから抜く.
			var ids = decode_postdata_params(request.request.postData.params).api_slotitem_ids;
			if (ids) slotitem_delete(ids.split('%2C'));
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kousyou/destroyship') {
		// 艦娘解体.
		func = function(json) { // 解体した艦娘が持つ装備を、リストから抜く.
			var id = decode_postdata_params(request.request.postData.params).api_ship_id;
			if (id) ship_delete([id]);
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kaisou/powerup') {
		// 近代化改修.
		func = function(json) { // 素材として使った艦娘が持つ装備を、リストから抜く.
			var ids = decode_postdata_params(request.request.postData.params).api_id_items;
			if (ids) ship_delete(ids.split('%2C'));
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kousyou/remodel_slot') {
		// 装備改修.
		func = function(json) {	// 明石の改修工廠で改修した装備をリストに反映する.
			add_slotitem_list(json.api_data.api_after_slot);	// 装備リストを更新する.
			slotitem_delete(json.api_data.api_use_slot_id);		// 改修で消費した装備を装備リストから抜く.
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kaisou/lock') {
		// 装備ロック.
		func = function(json) {
			var id = decode_postdata_params(request.request.postData.params).api_slotitem_id;	// ロック変更した装備ID.
			$slotitem_list[id].locked = json.api_data.api_locked;
			on_port(json);
		};
	}
	else if (api_name == '/api_req_hensei/change') {
		// 艦隊編成.
		var params = decode_postdata_params(request.request.postData.params);
		var list = $fdeck_list[params.api_id].api_ship;	// 変更艦隊リスト.
		var id  = parseInt(params.api_ship_id, 10);		// -2:一括解除, -1:解除, 他:艦娘ID.
		var idx = parseInt(params.api_ship_idx, 10);	// -1:一括解除, 0..N:変更位置.
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
		var dummy_json = { api_data: {} }; // 艦隊編成パケットは api_data を持たないので、母港表示にダミーパケットを渡す.
		on_port(dummy_json);
	}
	else if (api_name == '/api_get_member/questlist') {
		// 任務一覧.
		func = function(json) { // 任務総数と任務リストを記録する.
			var list = json.api_data.api_list;
			if (!list) return;
			$quest_count = json.api_data.api_count;
			$quest_exec_count = json.api_data.api_exec_count;
			if (json.api_data.api_disp_page == 1 && $quest_count != Object.keys($quest_list).length) {
				$quest_list = {}; // 任務総数が変わったらリストをクリアする.
			}
			list.forEach(function(data) {
				if (data == -1) return; // 最終ページには埋草で-1 が入っているので除外する.
				$quest_list[data.api_no] = data;
				if (data.api_no == 214) {
					get_weekly().quest_state = data.api_state; // あ号任務ならば、遂行状態を記録する(1:未遂行, 2:遂行中, 3:達成)
				}
			});
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/ndock') {
		// 入渠.
		func = function(json) { // 入渠状況を更新する.
			update_ndock_list(json.api_data);
			on_mission_check(5);
		};
	}
	else if (api_name == '/api_port/port') {
		// 母港帰還.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			update_ship_list(json.api_data.api_ship, true);
			update_fdeck_list(json.api_data.api_deck_port);
			update_ndock_list(json.api_data.api_ndock);
			$battle_deck_id = -1;
			$ship_escape = {};
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/ship2') {
		// 進撃.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			update_ship_list(json.api_data, true);
			update_fdeck_list(json.api_data_deck);
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/ship3') {
		// 装備換装.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			var is_all = true;
			if (decode_postdata_params(request.request.postData.params).api_shipid) {
				is_all = false; // 装備解除時は差分のみ.
			}
			update_ship_list(json.api_data.api_ship_data, is_all);
			update_fdeck_list(json.api_data.api_deck_data);
			on_port(json);
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
			on_port(json);
		};
	}
	else if (api_name == '/api_req_mission/result') {
		// 遠征結果.
		func = function(json) { // 成功状況を記録する.
			var d = json.api_data;
			var id = decode_postdata_params(request.request.postData.params).api_deck_id;
			$last_mission[id] = '前回遠征: ' + d.api_quest_name + ' ' + mission_clear_name(d.api_clear_result);
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
			$enemy_id = null;
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
