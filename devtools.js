// -*- coding: utf-8 -*-
var $ship_list		= load_storage('ship_list');
var $enemy_list		= load_storage('enemy_list');
var $mst_ship		= load_storage('mst_ship');
var $mst_slotitem	= load_storage('mst_slotitem');
var $mst_mission	= load_storage('mst_mission');
var $mst_mapinfo	= load_storage('mst_mapinfo');
var $weekly			= load_storage('weekly');
var $slotitem_list = {};
var $max_ship = 0;
var $max_slotitem = 0;
var $combined_flag = 0;
var $fdeck_list = {};
var $next_mapinfo = null;
var $next_enemy = null;
var $is_boss = false;
var $is_water = false;
var $material = {};
var $quest_count = 0;
var $quest_exec_count = 0;
var $quest_list = {};
var $battle_count = 0;
var $ndock_list = {};
var $enemy_id = null;
var $battle_log = [];
var $last_mission = {};
var $beginhps = null;
var $beginhps_c = null;
var $f_damage_rate = 0;
var $e_damage_rate = 0;


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

//------------------------------------------------------------------------
// データ保存と更新.
//
function load_storage(name) {
	var v = localStorage[name];
	return v ? JSON.parse(v) : {};
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

function update_enemy_list(id, fleet) {
	$enemy_list[id] = fleet;
	save_storage('enemy_list', $enemy_list);
}

function update_fdeck_list(list) {
	if (!list) return;
	$fdeck_list = {};
	list.forEach(function(deck) {
		$fdeck_list[deck.api_id] = deck;
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

function update_mst_ship(list) {
	if (!list) return;
	$mst_ship = {};
	list.forEach(function(data) {
		$mst_ship[data.api_id] = data;
	});
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

function kira_name(cond) {
	return (cond >= 85) ? '*** ' : // 三重キラ.
		   (cond >= 53) ? '** ' : // 回避向上キラ.
		   (cond >  49) ? '* ' : // キラ.
		   (cond == 49) ? '. ' : // normal
		 /* cond < 49 */  '> '; // recovering
};

function item_name(id) {
	switch (id) {
		case 1: return '燃料';
		case 2: return '弾薬';
		case 3: return '鋼材';
		case 4: return 'ボーキ';
		case 5: return '建造材';
		case 6: return '修復材';
		case 7: return '開発資材';
		case 8: return '改修資材';
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

function slotitem_name(id, n, max) {
	var item = $mst_slotitem[id];
	if (is_airplane(item) && n) return item.api_name + 'x' + n + percent_name_unless100(n, max);
	if (item) return item.api_name;
	return id.toString();
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

function slotitem_names(slot, onslot, maxslot) {
	if (!slot) return '';
	var a = [];
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value) {
			a.push(slotitem_name(value.item_id, onslot[i], maxslot[i]));
		}
	}
	return a.join(', ');
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
	case 10:// 水上爆撃機.
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
			+ '\t' + slotitem_names(ship.slot, ship.onslot, $mst_ship[ship.ship_id].api_maxeq)
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
// イベントハンドラ.
//
function on_port(json) {
	var req = [];
	var unlock_names = [];
	var lock_condlist = {};
	var cond85 = 0;
	var cond53 = 0;
	var cond50 = 0;
	var lockeditem_list = {};
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
				lockeditem_list[i][lv] = {count:0, ship_names:[]};
			lockeditem_list[i][lv].count++;
		}
		if (value && value.level) {
			$leveling_slotitem++;
		}
	}
	//
	// ロック艦のcond別一覧、未ロック艦一覧、ロック装備持ち艦を検出する.
	for (var id in $ship_list) {
		var ship = $ship_list[id];
		var name = ship.name_lv();
		if (!ship.locked) {
			var n = count_unless(ship.slot, -1); // スロット装備数.
			$unlock_slotitem += n;
			unlock_names.push(name + (n ? "*" : "")); // 装備持ちなら、名前の末尾に"*"を付ける.
		}
		else {	// locked
			var cond = ship.c_cond;
			if (!lock_condlist[cond]) lock_condlist[cond] = [];
			lock_condlist[cond].push(name);
			if      (cond >= 85) cond85++; // 三重キラ.
			else if (cond >= 53) cond53++; // 回避向上キラ.
			else if (cond >  49) cond50++; // キラ.
		}
		if (ship.slot) {
			ship.slot.forEach(function(id) {
				var value = $slotitem_list[id];
				if (value && value.locked)
					lockeditem_list[value.item_id][value.level].ship_names.push(name);
			});
		}
	}
	unlock_names.reverse();	// 最新の艦を先頭にする.
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
			if (diff.length) msg.push(item_name(id) + diff);
		});
	}
	req.push('資材増減数:' + msg.join(', '));
	//
	// 艦娘保有数、未ロック艦一覧、ロック艦キラ付一覧を表示する.
	req.push('艦娘保有数:' + Object.keys($ship_list).length + '/' + $max_ship
		+ '(未ロック:' + unlock_names.length + ', キラ付:***' + cond85 + ' **' + cond53 + ' *' + cond50 + ')');
	var msg = ['YPS_ship_list'];
	if (unlock_names.length > 0) {
		msg.push('## 未ロック艦一覧');
		msg.push('\t|' + unlock_names.join(', '));
	}
	if (Object.keys(lock_condlist).length > 0) {
		msg.push('## ロック艦一覧');
		msg.push('\t==cond\t==艦名'); // 表ヘッダ
		for (var cond = 100; cond >= 0; --cond) {
			var a = lock_condlist[cond];
			if (a) msg.push('\t' + kira_name(cond) + cond + '\t|' + a.join(', '));
		}
	}
	msg.push('---');
	if (msg.length > 2) req.push(msg);
	//
	// 装備数、ロック装備一覧を表示する.
	req.push('装備保有数:' + Object.keys($slotitem_list).length + '/' + $max_slotitem
		+ '(未ロック艦装備:' + $unlock_slotitem + ', 改修中装備:' + $leveling_slotitem + ')');
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
			for (lv in lockeditem_list[id]) {
				var item = lockeditem_list[id][lv];
				var lv_name = (lv > 0) ? '★+'+lv : '';
				msg.push('\t' + slotitem_name(id) + lv_name + '\t' + item.ship_names.length + '/' + item.count + '\t|' + item.ship_names.join(', '));
			}
		});
		msg.push('---');
		req.push(msg);
	}
	//
	// 遂行中任務を一覧表示する.
	if (Object.keys($quest_list).length > 0) {
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
	if (Object.keys($quest_list).length != $quest_count) req.push('### 任務リストを先頭から最終ページまでめくってください');
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

function on_next_cell(json) {
	var d = json.api_data;
	var e = json.api_data.api_enemy;
	var g = json.api_data.api_itemget;
	var area = d.api_maparea_id + '-' + d.api_mapinfo_no + '-' + d.api_no;
	$next_mapinfo = $mst_mapinfo[d.api_maparea_id * 10 + d.api_mapinfo_no];
	if (e) {
		$enemy_id = e.api_enemy_id;
		var msg = $enemy_id.toString(10);
		var fleet = $enemy_list[$enemy_id];
		if (d.api_event_id == 5) {
			area += '(boss)';
			$is_boss = true;
		}
		$next_enemy = area + ':' + $enemy_id;
		if (fleet) {
			msg += '\n\t' + fleet.join('\t');
			if(/潜水.級/.test(msg)) msg += '\n### 潜水艦注意!!';
		}
		chrome.extension.sendRequest('## next enemy\n' + area + ':' + msg);
	}
	if (g) {
		var msg = item_name(g.api_id) + 'x' + g.api_getcount;
		chrome.extension.sendRequest('## next item\n' + area + ':' + msg);
	}
}

function on_battle_result(json) {
	var d = json.api_data;
	var e = d.api_enemy_info;
	var g = d.api_get_ship;
	var mvp   = d.api_mvp;
	var mvp_c = d.api_mvp_combined;
	var lost  = d.api_lost_flag;
	var msg  = '';
	if (e) {
		var rank = d.api_win_rank;
		msg += e.api_deck_name;
		if (d.api_ship_id) {
			var total = count_unless(d.api_ship_id, -1);
			msg += '(' + d.api_dests + '/' + total + ')';
			if (rank == 'S' && $f_damage_rate == 0) rank = '完S';
		}
		msg += ':' + rank;
		var fleet = $enemy_list[$enemy_id];
		if (fleet) {
			fleet[0] = e.api_deck_name + ':';
		}
		$battle_log.push($next_enemy + '(' + e.api_deck_name + '):' + rank);
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
	if (g) {
		msg += '\n## drop ship\n';
		msg += g.api_ship_type + ':' + g.api_ship_name;
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

function push_guess_result(req, nowhps, maxhps, beginhps, nowhps_c, maxhps_c, beginhps_c) {
	// 友軍の轟沈／護衛退避には未対応
	// 応急修理発動時の計算も不明
	var f_damage_total = 0;
	var f_hp_total = 0;
	var f_lost_count = 0;
	var e_damage_total = 0;
	var e_hp_total = 0;
	var e_count = 0;
	var e_lost_count = 0;
	var e_leader_lost = false;
	for(var i = 1; i <= 6; ++i){
		// 友軍被害集計.
		if(maxhps[i] == -1) continue;
		var n = nowhps[i];
		f_damage_total += beginhps[i] - Math.max(0, n);
		f_hp_total += beginhps[i];
		if (n <= 0) {
			++f_lost_count;
		}
	}
	for (var i = 1; i <= 6; ++i) {
		// 連合第二友軍被害集計.
		if(!maxhps_c || maxhps_c[i] == -1) continue;
		var n = nowhps_c[i];
		f_damage_total += beginhps_c[i] - Math.max(0, n);
		f_hp_total += beginhps_c[i];
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
		if(n <= 0){
			++e_lost_count;
			if(i == 7) e_leader_lost = true;
		}
	}
	$f_damage_rate = f_damage_total / f_hp_total;
	$e_damage_rate = e_damage_total / e_hp_total;
	if (e_count == e_lost_count && f_lost_count == 0) {
		if(f_damage_total == 0) {
			req.push('推定：完S');
		} else {
			req.push('推定：S');
		}
		return;
	}
	if (e_lost_count >= (e_count == 6 ? 4 : e_count/2) && f_lost_count == 0) {
		req.push('推定：A');
		return;
	}
	var rate = $e_damage_rate == 0 ? 0 : // 潜水艦お見合い等ではDになるので敵ダメ判定を優先
			   $f_damage_rate == 0 ? 3 : // 0除算回避／こちらが無傷なら1ダメ以上与えていればBなのでrateを3に
			   $e_damage_rate / $f_damage_rate;
	if ((e_leader_lost && f_lost_count < e_lost_count) || rate >= 2.5) {
		req.push('推定：B');
		return;
	} else if(rate >= 1){ //要検証
		req.push('推定：C');
		return;
	} else {
		req.push('推定：D');
		return;
	}
	req.push('推定：E');
	return;
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
		f_lostcount : 0				// 非撃墜数.
	};
	calc_kouku_damage(airplane, nowhps, d.api_kouku, nowhps_c); // 航空戦.
	calc_kouku_damage(airplane, nowhps, d.api_kouku2, nowhps_c); // 航空戦第二波.
	calc_damage(nowhps, d.api_opening_atack, nowhps_c);	// 開幕雷撃.
	calc_damage(nowhps, d.api_hougeki, nowhps_c);	// midnight
	calc_damage(nowhps, d.api_hougeki1, $combined_flag == 2 ? null : nowhps_c);
	calc_damage(nowhps, d.api_hougeki2);
	calc_damage(nowhps, d.api_hougeki3, $combined_flag == 2 ? nowhps_c : null);
	calc_damage(nowhps, d.api_raigeki, nowhps_c);
	if (d.api_support_flag == 1) calc_damage(nowhps, d.api_support_info.api_support_airattack.api_stage3); // 1:航空支援.
	if (d.api_support_flag == 2) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 2:支援射撃
	if (d.api_support_flag == 3) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 3:支援長距離雷撃.
	if (!d.api_deck_id) d.api_deck_id = d.api_dock_id; // battleのデータは、綴りミスがあるので補正する.
	var fdeck = $fdeck_list[d.api_deck_id];
	$battle_deck_id = fdeck.api_id;
	var fmt = null;
	if (d.api_formation) {
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

	if (!$beginhps) $beginhps = beginhps;
	if (!$beginhps_c) $beginhps_c = beginhps_c;
	push_guess_result(req, nowhps, maxhps, $beginhps, nowhps_c, maxhps_c, $beginhps_c);
	req.push('## friend damage');
	push_fdeck_status(req, fdeck, maxhps, nowhps, beginhps);
	req.push('被撃墜数: ' + airplane.f_lostcount);
	if (nowhps_c) {
		req.push('## friend(2nd) damage');
		push_fdeck_status(req, $fdeck_list[2], maxhps_c, nowhps_c, beginhps_c); // 連合第二艦隊は二番固定です.
	}
	req.push('## enemy damage');
	var enemy_fleet = ['???'];
	for (var i = 1; i <= 6; ++i) {
		var ke = d.api_ship_ke[i];
		if (ke == -1) continue;
		var name = ship_name(ke) + 'Lv' + d.api_ship_lv[i];
		req.push('\t' + i + '(' + name + ').\t' + hp_status_on_battle(nowhps[i+6], maxhps[i+6], beginhps[i+6]));
		enemy_fleet.push(name);
	}
	if ($enemy_id) { // 演習は$enemy_idが空
		update_enemy_list($enemy_id, enemy_fleet);
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
			update_mst_mission(json.api_data.api_mst_mission);
			update_mst_mapinfo(json.api_data.api_mst_mapinfo);
			chrome.extension.sendRequest("## ロード完了");
		};
	}
	else if (api_name == '/api_get_member/slot_item') {
		// 保有装備一覧表.
		func = function(json) { // 保有する装備配列をリストに記録する.
			$slotitem_list = {};
			add_slotitem_list(json.api_data);
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
			on_port(json);
		};
	}
	else if (api_name == '/api_port/port') {
		// 母港帰還.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			update_ship_list(json.api_data.api_ship, true);
			update_fdeck_list(json.api_data.api_deck_port);
			update_ndock_list(json.api_data.api_ndock);
			$battle_deck_id = -1;
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
	if (!func) return;
	request.getContent(function (content) {
		if (!content) return;
		var json = JSON.parse(content.replace(/^svdata=/, ''));
		if (!json || !json.api_data) return;
		func(json);
	});
});
