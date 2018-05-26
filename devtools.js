// -*- coding: utf-8 -*-
var $mst_ship		= load_storage('mst_ship');
var $mst_slotitem	= load_storage('mst_slotitem');
var $mst_slotitemeq	= load_storage('mst_slotitemeq');
var $mst_mission	= load_storage('mst_mission');
var $mst_useitem	= load_storage('mst_useitem');
var $mst_mapinfo	= load_storage('mst_mapinfo');
var $mst_maparea	= load_storage('mst_maparea');
var $ship_list		= load_storage('ship_list');
var $slotitem_list	= load_storage('slotitem_list');
var $remodel_slotlist = load_storage('remodel_slotlist');
var $remodel_slotweek = load_storage('remodel_slotweek');
var $enemy_db		= load_storage('enemy_db');
var $weekly			= load_storage('weekly');
var $logbook		= load_storage('logbook', []);
var $quest_list		= load_storage('quest_list');
var $debug_battle_json = null;
var $debug_ship_names = [];
var $debug_api_name = '';
var $tmp_ship_id = -1000;	// ドロップ艦の仮ID.
var $tmp_slot_id = -1000;	// ドロップ艦装備の仮ID.
var $max_ship = 0;
var $max_slotitem = 0;
var $command_lv = 0;
var $combined_flag = 0;
var $fdeck_list = {};
var $ship_fdeck = {};
var $ship_escape = {};	// 護衛退避したshipidのマップ.
var $mapinfo_rank = {};	// 海域難易度 undefined:なし, 1:丁, 2:丙, 3:乙, 4:甲.
var	$locked_ship_idset = {};	// ロック艦の艦種IDセット.
var $next_mapinfo = null;
var $next_enemy = null;
var $is_boss = false;
var $is_next = false;
var $material = {
	// [燃料,弾薬,鋼材,ボーキ, バーナー,バケツ,歯車,螺子]
	mission: [0,0,0,0, 0,0,0,0],	///< 遠征累計.
	quest  : [0,0,0,0, 0,0,0,0],	///< 任務累計.
	charge : [0,0,0,0, 0,0,0,0],	///< 補給累計.
	ndock  : [0,0,0,0, 0,0,0,0],	///< 入渠累計.
	dropitem    : [0,0,0,0, 0,0,0,0],	///< 道中資源累計.
	autosupply  : [0,0,0,0, 0,0,0,0],	///< 自然増加/轟沈回収累計.
	createship  : [0,0,0,0, 0,0,0,0],	///< 艦娘建造/改造累計.
	createitem  : [0,0,0,0, 0,0,0,0],	///< 装備開発累計.
	remodelslot : [0,0,0,0, 0,0,0,0],	///< 装備改修累計.
	destroyship : [0,0,0,0, 0,0,0,0],	///< 艦娘解体累計.
	destroyitem : [0,0,0,0, 0,0,0,0],	///< 装備破棄累計.
	now : [],	///< 現在資材. 初回は全項目undefinedとする.
	beg : null,	///< 初期資材. 初回更新時にnowのコピーを保持する.
	diff: ""	///< 変化量メッセージ.
};
var $material_sum = null;
var $quest_count = -1;
var $quest_exec_count = 0;
var $battle_count = 0;
var $ndock_list = {};
var $do_print_port_on_ndock = false;
var $do_print_port_on_slot_item = false;
var $kdock_list = {};
var $battle_api_data = null;
var $battle_deck_id = -1;
var $battle_log = [];
var $last_mission = {};
var $f_maxhps = null;
var $f_beginhps = null;
var $e_beginhps = null;
var $e_prevhps = null;
var $f_damage = 0;
var $e_lost_count = 0;
var $e_leader_lost = false;
var $guess_win_rank = '?';
var $guess_info_str = '';
var $pcDateTime = null;
var $svDateTime = null;
var $newship_slots = null;
var $enemy_formation = '';
var $enemy_ship_names = [];
var $log_daily = 0;
var $kaizou_list_orig = null;
var $convert_list_orig = null;

//-------------------------------------------------------------------------
// Ship クラス.
function Ship(data, ship) {
	this.p_cond	= (ship) ? ship.c_cond : 49;
	this.sortie_dn	= (ship) ? ship.sortie_dn : 0;
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
	this.taiku = data.api_taiku;
	this.taisen = data.api_taisen;
	this.sakuteki = data.api_sakuteki;
	this.nextlv	= data.api_exp[1];
	if (data.api_slot_ex > 0) {		// api_slot_ex:: 0:増設スロットなし, -1:増設スロット空,　1以上:増設スロット装備ID.
		this.slot.push(data.api_slot_ex);
	}
	if (data.api_sally_area !== null) { // お札情報 イベント中限定 0: 札なし, 1～ : 各種札
		this.sally_area = data.api_sally_area;
	}
}

Ship.prototype.name_lv = function() {
	return ship_name(this.ship_id) + 'Lv' + this.lv;
};

Ship.prototype.fleet_name_lv = function() {
		var name = this.name_lv();
		var fdeck = $ship_fdeck[this.id];
		if (fdeck) name = '(艦隊' + fdeck + ')' + name; // 頭に艦隊番号を付ける.
		return name;
};

Ship.prototype.fleet_name_lv_afterlv = function() {
	return this.fleet_name_lv() + '(' + $mst_ship[this.ship_id].api_afterlv + ')';
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

Ship.prototype.will_kaizou = function() {
	var afterlv = $mst_ship[this.ship_id].api_afterlv;
	return afterlv && afterlv > this.lv;
};

Ship.prototype.can_convert = function() {
	if(!this.can_kaizou()) {
		return false;
	}
	var current = $mst_ship[this.ship_id]
	var after = $mst_ship[current.api_aftershipid];
	return after.api_aftershipid == this.ship_id && current.api_afterlv <= this.lv && after.api_afterlv <= this.lv;
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

function get_begin_shipid(ship_id) {
	var mst = $mst_ship[ship_id];
	return mst.yps_begin_shipid ? mst.yps_begin_shipid : ship_id;
}

Ship.prototype.begin_shipid = function() {
	return get_begin_shipid(this.ship_id);
};

Ship.prototype.slot_names = function() {
	var slot = this.slot;
	var onslot = this.onslot;
	var maxslot = $mst_ship[this.ship_id].api_maxeq;
	var slotnum = $mst_ship[this.ship_id].api_slot_num; // 通常スロット数.
	var a = [];
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value) {
			a.push(slotitem_name(value.item_id, value.level, value.alv, value.p_alv, onslot[i], maxslot[i]));
		}
		else if (slot[i] == -1 && i < slotnum) {
			a.push('空');
		}
	}
	return a.join(', ');
};

Ship.prototype.slot_seiku = function() {	///< 制空値.
	var slot = this.slot;
	var onslot = this.onslot;
	var a = 0;
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value) {
			a += slotitem_seiku(value.item_id, value.level, value.alv, onslot[i]);
		}
	}
	return a;
};

Ship.prototype.blank_slot_num = function() {	///< 通常スロットの空き数を返す(補強スロットは対象外とする)
	var num = 0;
	var slot = this.slot;
	var slotnum = $mst_ship[this.ship_id].api_slot_num;
	for (var i = 0; i < slot.length; ++i) {
		if (slot[i] == -1 && i < slotnum) ++num;
	}
	return num;
};

Ship.prototype.next_level = function () {
	return 'あと ' + this.nextlv;
};

//------------------------------------------------------------------------
// データ保存と更新.
//
function sync_cloud() {
	chrome.storage.sync.get({weekly: $weekly}, function(a) {
		if ($weekly.savetime < a.weekly.savetime) $weekly = a.weekly;
	});
}

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
					$slotitem_list[$tmp_slot_id] = null; // 個数を合せるためnullのダミーエントリを追加する. 母港帰還時 /api_get_member/slot_item にリストが全更新される.
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

function update_slotitem_list(list) {
	if (!list) return;
	var prev = $slotitem_list;
	$slotitem_list = {};
	add_slotitem_list(list, prev);
	save_storage('slotitem_list', $slotitem_list);
}

function update_mst_ship(list) {
	if (!list) return;
	$mst_ship = {};
	var before = {};
	list.forEach(function(data) {
		$mst_ship[data.api_id] = data;
		if (data.api_aftershipid && before[data.api_aftershipid] == null)
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

function update_mst_slotitemeq(list) {
	if (!list) return;
	$mst_slotitemeq = {};
	list.forEach(function(data) {
		$mst_slotitemeq[data.api_id] = data;
	});
	save_storage('mst_slotitemeq', $mst_slotitemeq);
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

function update_mst_maparea(list) {
	if (!list) return;
	$mst_maparea = {};
	list.forEach(function(data) {
		$mst_maparea[data.api_id] = data.api_name;
	});
	save_storage('mst_maparea', $mst_maparea);
}

function get_weekly() {
	const now = Date.now();
	const ms = now - Date.UTC(2013, 4-1, 22, 5-9, 0); // 2013-4-22 05:00 JST からの経過ミリ秒数.
	var dn = Math.floor(ms / (24*60*60*1000)); // 経過日数に変換する.
	var wn = Math.floor(dn / 7); // 経過週数に変換する.
	var hn = Math.floor((ms + 2*60*60*1000) / (12*60*60*1000)); // 演習更新数(03:00JST起点の半日周期)に変換する.
	if ($weekly == null || $weekly.week != wn) {
		$weekly = {
			quest_state : 0, // あ号任務状況(1:未遂行, 2:遂行中, 3:達成)
			sortie    : 0,
			boss_cell : 0,
			win_boss  : 0,
			win_S     : 0,
			monday_material : null,
			week      : wn,
			savetime : 0
		};
	}
	if ($weekly.daily != dn) {
		const date = new Date(now + 9*60*60*1000);
		$weekly.month = date.getUTCMonth();	// 実行環境のタイムゾーンに関係なくJSTの月番号が必要なので, タイムゾーン分ずらした世界時で月番号を得る.
		$weekly.daily = dn;
		$weekly.saveime = 0;
		$quest_count = -1; // 日替わりで任務リストが更新されるので、任務のリセットを予約する.
	}
	if ($weekly.halfdaily != hn) {
		$weekly.halfdaily = hn;
		$weekly.practice_done = 0;
		$weekly.saveime = 0;
	}
	if ($weekly.monday_material == null) {
		$weekly.monday_material = $material.now.concat();
		$weekly.saveime = 0;
	}
	if ($weekly.saveime == 0) save_weekly();
	return $weekly;
}

function month_to_quarter(m) {	///< m 0(Jan)..11(Dec) ->  1:Dec,Jan,Feb, 2:Mar,Apr,May, 3:Jun,Jul,Aug, 4:Sep,Oct,Nov.
	return Math.floor(((m+1)%12)/3)+1;
}

function save_weekly() {
	$weekly.savetime = Date.now();
	chrome.storage.sync.set({weekly: $weekly});
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

function to_string(id,nullstr) {	///< id == null に対して代理文字列を返し、例外落ちしない.
	if (id == null) return nullstr ? nullstr : '';
	return id.toString();
}

function to_date(a) {	///< aが日付型ではなければ日付型に変換して返す.
	if (a instanceof Date) return a;
	return new Date(a);
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

function combined_name() {
	switch ($combined_flag) {
		case 1: return '連合機動部隊';
		case 2: return '連合水上部隊';
		case 3: return '連合輸送護衛部隊';
		default: return to_string(id);
	}
}

function formation_name(id) {
	switch (parseInt(id, 10)) {	// 連合艦隊戦闘では id が数値ではなく文字列になっている.
		case 1: return '単縦';
		case 2: return '複縦';
		case 3: return '輪形';
		case 4: return '梯形';
		case 5: return '単横';
		case 6: return '警戒';
		case 11: return '連合対潜警戒';
		case 12: return '連合前方警戒';
		case 13: return '連合輪形陣';
		case 14: return '連合戦闘隊形';
		default: return to_string(id);
	}
}

function match_name(id) {
	switch (id) {
		case 1: return '同航';
		case 2: return '反航';
		case 3: return 'Ｔ字有利';
		case 4: return 'Ｔ字不利';
		default: return to_string(id);
	}
}

function support_name(id) {	///@param id	支援タイプ api_support_flag
	switch (id) {
		case 1: return '航空支援';
		case 2: return '支援射撃';
		case 3: return '支援長距離雷撃';
		case 4: return '対潜支援哨戒';
		default: return to_string(id);
	}
}

function seiku_name(id) {	///@param id	制空権 api_disp_seiku
	switch (id) {
		case 1: return '制空権確保';
		case 2: return '航空優勢';
		case 0: return '航空互角';
		case 3: return '航空劣勢';
		case 4: return '制空権喪失';
		default: return to_string(id);
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
		default: return to_string(id);
	}
}

function event_sally_tag_name(id) {	///@param id	イベント札番号 api_sally_area.
	return $event_sally_tag_names[id] || '札'+to_string(id);
}

function event_kind_name(id) {	///@param id	非戦闘マスのメッセージ api_event_kind.
	switch (id) {
		case 0: return '気のせいだった';
		case 1: return '敵影を見ず';
		case 2: return '能動分岐';
		case 3: return '穏やかな海です';
		case 4: return '穏やかな海峡です';
		case 5: return '警戒が必要です';
		case 6: return '静かな海です';
		default: return $event_kind_names[id] || '??'+to_string(id);
	}
}

function battle_kind_name(id) { ///@param id	戦闘マスのメッセージ api_event_kind.
	switch (id) {
		case 1: return ''; // 通常戦.
		case 2: return '夜戦';
		case 3: return '払暁戦'; // 夜昼戦.
		case 4: return '航空戦';
		case 5: return '通常戦(敵連合)';
		case 6: return '空襲戦';
		case 7: return '払暁戦(敵連合)'; // 夜昼戦(敵連合).
		default: return '??'+to_string(id);
	}
}

function battle_api_kind_name(name) { ///@param name	battle_api_name.
	if (/midnight/.test(name))     return '夜戦';
	if (/night_to_day/.test(name)) return '払暁戦'; // 夜昼戦.
	if (/ld_airbattle/.test(name)) return '空襲戦';
	if (/airbattle/.test(name))    return '航空戦';
	return '';
}

function mission_clear_name(cr) {	///@param c	遠征クリア api_clear_result
	switch (cr) {
		case 1: return '成功';
		case 2: return '大成功';
		default: return '失敗';
	}
}

function boss_next_name() {
	if ($is_boss) return '(boss)';
	if (!$is_next) return '(end)';
	return '';
}

function slotitem_name(id, lv, alv, p_alv, n, max) {
	var item = $mst_slotitem[id];
	if (!item) return id.toString();	// unknown slotitem.
	var name = item.api_name;
	if (lv >= 10) name += '★max';		// 改修レベルを追加する.
	else if (lv >= 1) name += '★+' + lv;	// 改修レベルを追加する.
	if (alv >= 1 || alv < p_alv) {
		if (alv >= 7) name += '♥♥';	// 熟練度最大なら♥２個を追加する.
		else name += '♥' + alv;		// さもなくば熟練度数値を追加する.
		var diff = diff_name(alv, p_alv);
		if (diff.length > 0) name += '@!!' + diff + '!!@';	// 熟練度変化量を追加する.
	}
	if (is_airplane(item) && n != null) name += (n == 0 && n < max) ? 'x0(@!!全滅!!@)' : 'x' + n + percent_name_unless100(n, max);	// 航空機なら、機数と搭載割合を追加する.
	return name;
}

function slotitem_seiku(id, lv, alv, n, airbase) {
	// airbase ::= undefined:艦隊制空戦, 1:基地航空隊出撃, 2:基地航空隊防空
	// https://gist.github.com/YSRKEN/4cdecc6e8a1c2c75b13b08126c94f4cf の制空値計算式を採用する.
	// http://kancollecalc.web.fc2.com/air_supremacy.html の計算結果に合うように計算式を修正する.
	// seiku(attack)    ::= floor((P + Ga * lv + 1.5 * In)    * sqrt(n) + sqrt(v/10) + Vc)
	// seiku(intercept) ::= floor((P + Ga * lv + In + 2 * Ba) * sqrt(n) + sqrt(v/10) + Vc)
	// lv ::= 改修レベル:0-10
	// alv::= 熟練度:0-7
	// n  ::= 搭載機数.
	// P  ::= 装備対空値. api_tyku
	// In ::= 装備迎撃値. 局地戦闘機:api_houk, その他:0
	// Ga ::= 改修レベル係数. 艦上戦闘機&水上戦闘機:0.2, 艦上爆撃機:0.25, その他:0
	// v  ::= 内部熟練度:0-120
	// Vc ::= 熟練度ボーナス. 艦上戦闘機&水上戦闘機:0-22, 水上爆撃機:0-6, その他:0
	// Ba ::= 対爆値. api_houm
	var item = $mst_slotitem[id];
	if (!is_airplane(item)) return 0;
	var seiku = 0;
	var In = 0;
	var Ba = 0;
	var Ga = 0;
	var Vc = null;
	switch (item.api_type[2]) {
	case 48:// 局地戦闘機.
		In = item.api_houk;
		Ba = item.api_houm;
		break;
	case 6:	// 艦上戦闘機.
	case 45:// 水上戦闘機.
		Ga = 0.2;
		Vc = [0, 0, 2, 5, 6, 14, 14, 22];
		break;
	case 7:	// 艦上爆撃機.
		Ga = 0.25;
		break;
	case 11:// 水上爆撃機.
		Vc = [0, 0, 1, 1, 1, 3, 3, 6];
		break;
	case 9:	// 艦上偵察機.
	case 10:// 水上偵察機.
	case 41:// 大型飛行艇.
		if (airbase == null) return 0; // 艦隊制空戦に参加しない機種.
		break;
	case 25:// オートジャイロ.
	case 26:// 対潜哨戒機.
		return 0; // 制空戦に参加しない機種.
	case 8:	// 艦上攻撃機.
	case 47:// 陸上攻撃機.
	case 56:// 噴式戦闘機.
	case 57:// 噴式戦闘爆撃機.
	case 58:// 噴式攻撃機.
	case 59:// 噴式偵察機.
	case 94:// 艦上偵察機（II）.
		break;
	}
	if (n > 0) {
		var P = item.api_tyku;
		if (airbase == 2)
			seiku += (P + Ga * lv + In + 2 * Ba) * Math.sqrt(n);
		else
			seiku += (P + Ga * lv + 1.5 * In) * Math.sqrt(n);
	}
	if (alv > 0) {
		var v = [0, 10, 25, 40, 55, 70, 85, 100][alv];	// 内部熟練度:下端.
	//	var v = [9, 24, 39, 54, 69, 85, 99, 120][alv];	// 内部熟練度:上端.
		seiku += Math.sqrt(v / 10.0);
		if (Vc) seiku += Vc[alv];	// Vc: 艦上戦闘機、水上戦闘機.
	}
	return Math.floor(seiku);
}

function slotitem_intercept_bonus(id){
	var item = $mst_slotitem[id];
	var saku = item.api_saku;
	switch (item.api_type[2]) {
	case 10:// 水上偵察機.
	case 41:// 大型飛行艇.
		if(saku >=9) return 1.16;
		if(saku ==8) return 1.13;
		if(saku <=7) return 1.1;
	case 9:	// 艦上偵察機.
	case 94:// 艦上偵察機（II）.
		if(saku >=9) return 1.3;
		if(saku <=7) return 1.2;
	case 48:// 局地戦闘機.
	case 6:	// 艦上戦闘機.
	case 45:// 水上戦闘機.
	case 7:	// 艦上爆撃機.
	case 11:// 水上爆撃機.
	case 25:// オートジャイロ.
	case 26:// 対潜哨戒機.
	case 8:	// 艦上攻撃機.
	case 47:// 陸上攻撃機.
	case 56:// 噴式戦闘機.
	case 57:// 噴式戦闘爆撃機.
	case 58:// 噴式攻撃機.
	case 59:// 噴式偵察機.
		return 1;
	}
}

function slotitem_sakuteki(id, lv) { // 装備の素索敵値と索敵スコア判定式(33)値を返す.
	var item = $mst_slotitem[id];
	var raw = item.api_saku; // 装備素索敵値.
	var k = 0; // 装備係数.
	var s = 0; // 改修による索敵強化値.

	// 改修による索敵強化値
	switch (item.api_type[2]) {
		case 12:// 小型電探.
			s = 1.25 * Math.sqrt(lv);
			break;
		case 13:// 大型電探.
			s = 1.40 * Math.sqrt(lv);
			break;
		case 9:	// 艦上偵察機.
		case 10:// 水上偵察機.
			s = 1.20 * Math.sqrt(lv);
			break;
	}
	// 装備係数.
	switch (item.api_type[2]) {
		case 7:	// 艦上爆撃機.
		case 12:// 小型電探.
		case 13:// 大型電探.
		case 29:// 探照灯.
		case 42:// 大型探照灯.
		case 57:// 噴式戦闘爆撃機.
		case 6:	// 艦上戦闘機.
		case 45:// 水上戦闘機.
		case 41:// 大型飛行艇.
		case 14:// ソナー.
		case 39:// 水上艦要員.
		case 26:// 対潜哨戒機.
		case 34:// 艦隊司令部施設.
		case 51:// 潜水艦装備.
			k = 0.6;
			break;
		case 8:	// 艦上攻撃機.
			k = 0.8;
			break;
		case 9:	// 艦上偵察機.
			k = 1.0;
			break;
		case 10:// 水上偵察機.
			k = 1.2;
			break;
		case 11:// 水上爆撃機.
			k = 1.1;
			break;
	}
	this.raw = raw;
	this.score33 = k * (raw + s);
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

function slotitem_hougeki_name(id) {
	var item = $mst_slotitem[id];
	if (!item) return 'item' + to_string(id);	// unknown slotitem.
	var type = item.api_type[0];
	switch (type) {
	case 1: return '砲撃';
	case 2: return '雷撃';
	case 3: return '空爆';
	case 5: return '対潜'; // 偵察機.
	case 7: return '対潜';
	default: return '??' + to_string(type);	// other type
	}
}

function slotitem_hougeki_names(idlist) {
	if (!idlist) return '';
	var names = [];
	for (var i in idlist) {
		var id = idlist[i];
		if (id > 0) names.push(slotitem_hougeki_name(id));
		else if (id == -1) names.push('砲撃?'); // 対潜/空爆の場合あり. 装備ではなく相手艦種で決めている??
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
	return to_string(id, "null");
}

function shiplist_names(list, method) {	// Shipの配列をlv降順に並べて、","区切りの艦名Lv文字列化する.
	if (!method) method = 'fleet_name_lv';
	list.sort(function(a, b) { return (b.lv == a.lv) ? a.id - b.id : b.lv - a.lv; }); // lv降順、同一lvならid昇順(古い順)でソートする.
	var names = [];
	var last = null;
	for (var i in list) {
		if (!last || last.ship != list[i]) names.push(last = {count:0, ship:list[i]});
		last.count++;
	}
	for (var i in names) {
		var e = names[i];
		var name = e.ship[method]();	// デフォルトは "(艦隊N)艦名LvN"
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

function damage_name(nowhp, maxhp, damage) {
	if (damage != null && nowhp + damage <= 0) return '撃沈済';
	var r = nowhp / maxhp;
	return (r <= 0) ? '撃沈---'
		: (r <= 0.25) ? '大破!!!'
		: (r <= 0.50) ? '中破'
		: (r <= 0.75) ? '小破'
		: (r <= 0.85) ? '..'	// 軽微2.
		: (r <  1.00) ? '.'		// 軽微1.
		: '*';					// 無傷.
}

function battle_type_name(a, si) {
	switch (a) {
	case 0: return slotitem_hougeki_names(si);
	case 1: return 'レーザー';
	case 2: return '連撃';
	case 3: return '主副カットイン';
	case 4: return '主電カットイン';
	case 5: return '主徹カットイン';
	case 6: return '主主カットイン';
	case 7: return '戦爆連合カットイン';
	default: return a; // 不明.
	}
}

function battle_sp_name(a, si) {
	switch (a) {
	case 0: return slotitem_hougeki_names(si);
	case 1: return '連撃';
	case 2: return '主魚カットイン';
	case 3: return '魚魚カットイン';
	case 4: return '主副カットイン';
	case 5: return '主主カットイン';
	case 6: return '空母夜襲カットイン';
	case 7: return '主魚電カットイン';
	case 8: return '魚見電カットイン';
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

function map_name(mst) { // "演習 5", "1-1: 鎮守府正面海域", "40-2甲: 台湾沖/ルソン島沖 TP363/400(90%)" etc..
	if (!mst) mst = $next_mapinfo;
	let s = mst.api_name;
	if (mst.api_no) s = mst.api_maparea_id + '-' + mst.api_no + map_rank_name($mapinfo_rank[mst.api_id]) + ': ' + s;
	if (mst.yps_opt_name) s +=  ' ' + mst.yps_opt_name;
	return s;
}

function map_rank_name(a) {
	switch (a) {
	case 1: return '丁';
	case 2: return '丙';
	case 3: return '乙';
	case 4: return '甲';
	default: return '';
	}
}

function get_maparea_name(id) {
	return $mst_maparea[id];
}

function get_air_base_action_name(kind) {
	switch (kind) {
	case 0: return '待機';
	case 1: return '出撃';
	case 2: return '防空';
	case 3: return '退避';
	case 4: return '休息';
	default: return kind;
	}
}

function get_squadron_name(sid) {
	switch (sid) {
	case 1: return '第一中隊';
	case 2: return '第二中隊';
	case 3: return '第三中隊';
	case 4: return '第四中隊';
	default: return sid;
	}
}

function get_squadron_cond_name(cond) {
	switch (cond) {
	case 1: return '通常';
	case 2: return '疲労';
	case 3: return '赤疲労';
	default: return cond;
	}
}

function push_listform(ary, data) {
	if (data instanceof Array)
		data.forEach(function(a) { ary.push('* ' + a); });
	else
		ary.push('* ' + data);
}

//------------------------------------------------------------------------
// データ解析.
//
function decode_postdata_params(params) {
	var r = {};
	if (params instanceof Array) params.forEach(function(data) {
		if (data.name && data.value) {
			var name  = decodeURIComponent(data.name);
			var value = decodeURIComponent(data.value);
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

function array_push(obj, id, value) {
	if (obj[id] instanceof Array)
		obj[id].push(value);
	else
		obj[id] = [value];
}

function add_slotitem_list(data, prev) {
	if (!data) return;
	if (data instanceof Array) {
		data.forEach(function(e) {
			add_slotitem_list(e, prev);
		});
	}
	else if (data.api_slotitem_id) {
		var item = { item_id: data.api_slotitem_id, locked: data.api_locked, level: data.api_level };
		var alv = data.api_alv;
		if (alv != null) {
			var p_item = prev ? prev[data.api_id] : $slotitem_list[data.api_id];
			item.p_alv = p_item ? p_item.alv : alv;
			item.alv = alv;
		}
		$slotitem_list[data.api_id] = item;
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
			slot[i] = -1; return value.item_id;
		}
	}
	return 0;
}

function slotitem_delete(slot) {
	if (!slot) return;
	slot.forEach(function(id) {
		delete $slotitem_list[id];
	});
}

function ship_delete(list, keep_slot) {
	if (!list) return;
	for (let id of list) {
		let ship = $ship_list[id];
		if (ship) {
			if (!keep_slot) slotitem_delete(ship.slot);
			delete $ship_list[id];
		}
		let f_id = $ship_fdeck[id];
		if (f_id) {
			let shiplist = $fdeck_list[f_id].api_ship;
			for (let i = 0; i < shiplist.length; ++i) {
				if (shiplist[i] != id) continue;
				shiplist.splice(i, 1);
				shiplist.push(-1);
			}
			delete $ship_fdeck[id];
		}
	}
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
	case 45:// 水上戦闘機.
	case 47:// 陸上攻撃機.
	case 48:// 局地戦闘機.
	case 56:// 噴式戦闘機.
	case 57:// 噴式戦闘爆撃機.
	case 58:// 噴式攻撃機.
	case 59:// 噴式偵察機.
	case 94:// 艦上偵察機（II）.
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

function Daihatu() {
	this.sum = 0;
	this.level = 0;
	this.up = 0;
	this.up2 = 0;
	this.up3 = 0;
}

Daihatu.prototype.count_up = function(value) {
	if (!value) return;
	switch (value.item_id) {
	case 68:	// 大発動艇.
		this.up += 5;
		this.up3 += 2; // 特大発3個以上の場合のシナジー効果 * 10.
		this.level += value.level;
		this.sum++;
		break;
	case 166:	// 大発動艇(八九式中戦車＆陸戦隊).
		this.up += 2;
		this.level += value.level;
		this.sum++;
		break;
	case 167:	// 特二式内火艇.
		this.up += 1;
		this.level += value.level;
		this.sum++;
		break;
	case 193:	// 特大発動艇.
		this.up += 5;
		this.up2 += 2;
		this.level += value.level;
		this.sum++;
		break;
	}
	if (value.ship_id == 487) { // 鬼怒改二.
		this.up += 5;
	}
}

Daihatu.prototype.calc_up = function() {
	var u = Math.min(20, this.up); // 素効果の上限は20%.
	if (this.sum) u += 0.01 * Math.floor(u * this.level / this.sum); // 大発系改修★の平均値を加算する.
	var u2 = 0; // 特大発効果.
	if      (this.up2 > 6) u2 = (54 + (this.up3 > 6 ? 6 : this.up3 > 5 ? 5 : this.up3)) / 10; // 特大発4個以上: 5.4%, 5.6%, 5.8%, 5.9%, 6.0% ...
	else if (this.up2 > 5) u2 = (48 + (this.up3 > 6 ? 6 : this.up3 < 2 ? 2 : this.up3)) / 10; // 特大発3個:     5.0%, 5.0%, 5.2%, 5.4%, 5.4% ...
	else                   u2 = this.up2; // 特大発0,1,2個: 0.0%, 2.0%, 4.0%.
	return u + u2;
}

function Sakuteki33(name, ships, fleet_max) {
	// 索敵スコア判定式(33) ::= Σ sqrt(各艦素索敵値) + 分岐点係数c * Σ (装備係数k * (装備素索敵値raw + 装備改修による索敵強化値s)) - ceil(0.4 * 司令部レベル) + 2 * 艦隊空き数.
	var c = 1;
	var score = 0;
	var m = null;
	if      (/^1-6/.test(name)) { c = 3; }
	else if (/^2-5/.test(name)) { c = 1; }
	else if (/^3-5/.test(name)) { c = 4; }
	else if (/^6-1/.test(name)) { c = 4; }
	else if (/^6-2/.test(name)) { c = 3; }
	else if (/^6-5/.test(name)) { c = 3; }
	else if (m = /^(\d);/.exec(name)) { c = m[1]; }
	// 各艦の索敵スコアを合計する.
	for (var i in ships) {
		var slot = ships[i].slot;
		var raw  = ships[i].sakuteki[0];
		var s33 = 0;
		for (var i = 0; i < slot.length; ++i) {
			var value = $slotitem_list[slot[i]];
			if (value) {
				var r = new slotitem_sakuteki(value.item_id, value.level);
				s33 += r.score33;
				raw -= r.raw; // 艦娘の素索敵値を計算する。sakuteki[1]はケッコンカッコカリ前の索敵値なので使えない.
			}
		}
		score += Math.sqrt(raw) + c * s33;
	}
	// 司令部レベルと艦隊空き数による補正値を算入する.
	score -= Math.ceil(0.4 * $command_lv);
	score += 2 * (fleet_max - ships.length);
	this.score = score;
	this.msg = score.toFixed(2) + "(分岐点係数" + c + ")";
}

function fleet_brief_status(deck, deck2) {
	var cond_list = [];
	var esc = 0, sunk = 0;
	var ndockin = 0;
	var unlock = 0;
	var damage_H = 0;
	var damage_M = 0;
	var damage_L = 0;
	var fuel = 0, fuel_max = 0;
	var bull = 0, bull_max = 0;
	var drumcan = {ships:0, sum:0};
	var daihatu = new Daihatu();
	var ships = [];
	var akashi = '';
	var blank_slot_num = 0;
	var slot_seiku = 0;
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
			if ($ndock_list[ship.id]) ndockin++; // 修理中.
			if (!ship.locked) unlock++; // ロック無し.
			// 装備集計.
			var d = slotitem_count(ship.slot, 75);	// ドラム缶.
			if (d) {
				drumcan.ships++;
				drumcan.sum += d;
			}
			ship.slot.forEach(function(data) {
				daihatu.count_up($slotitem_list[data]);
			});
			blank_slot_num += ship.blank_slot_num();
			slot_seiku     += ship.slot_seiku();
			ships.push(ship);
			// 明石検出.
			var name = ship.name_lv();
			if (/明石/.test(name)) {
				akashi += ' ' + name;
			}
			// 鬼怒改二.
			daihatu.count_up(ship);
		}
	}
	var sakuteki = new Sakuteki33(deck.api_name, ships, list.length);
	var ret = kira_names(cond_list)
		+ ' 燃料' + fuel + percent_name_unless100(fuel, fuel_max)
		+ ' 弾薬' + bull + percent_name_unless100(bull, bull_max)
		+ (esc  ? ' 退避' + esc : '')
		+ (sunk ? ' 撃沈' + sunk : '')
		+ (damage_H ? ' 大破!!!' + damage_H : '')
		+ (damage_M ? ' 中破' + damage_M : '')
		+ (damage_L ? ' 小破' + damage_L : '')
		+ (ndockin ? ' 修理中' + ndockin : '')
		+ (unlock ? ' 未ロック' + unlock : '')
		+ (drumcan.sum ? ' ドラム缶' + drumcan.sum + '個' + drumcan.ships + '隻' : '')
		+ (daihatu.up  ? ' 大発' + daihatu.sum + '個'+ daihatu.calc_up() + '%遠征UP' : '')
		+ (slot_seiku  ? ' 制空値' + slot_seiku : '')
		+ (sakuteki.score > 0 ? ' 索敵スコア' + sakuteki.msg : '')
		+ (blank_slot_num ? ' 空スロット' + blank_slot_num : '')
		+ akashi
		;
	return ret.trim();
}

function push_fleet_status(msg, deck) {
	var lv_sum = 0;
	var sakuteki_sum = 0;
	var taiku_sum = 0;
	var taisen_sum = 0;
	var fleet_ships = 0;
	for (let s_id of deck.api_ship) {
		let ship = $ship_list[s_id];
		if (!ship) continue;
		fleet_ships++;
		lv_sum += ship.lv;
		sakuteki_sum += ship.sakuteki[0];
		taiku_sum += ship.taiku[0];
		taisen_sum += ship.taisen[0];
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
			+ '\t|' + ship.slot_names()
			+ '\t' + ship.next_level()
			);
	}
	msg.push('\t合計' + fleet_ships +'隻:\tLv' + lv_sum + '\t索敵:' + sakuteki_sum + '\t対空:' + taiku_sum + '\t対潜:' + taisen_sum);
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
	get_weekly();	// 週初めにnowのコピーを保持する.
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
function debug_print_mst_slotitem() {
	var msg = ['YPS_mst_slotitem', '\t==id\t==name\t==type0\t==type1\t==type2\t==type3'];
	for (var id in $mst_slotitem) {
		var item = $mst_slotitem[id];
		msg.push('\t' + item.api_id + '\t' + item.api_name + '\t' + item.api_type.join('\t'));
	}
	var req = [];
	req.push('### mst_slotitem');
	req.push(msg);
	chrome.runtime.sendMessage({appendData: req});
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
	req.push('### newship_slots');
	req.push(msg);
	chrome.runtime.sendMessage({appendData: req});
}

function debug_print_as_json(data, name) {
	var msg = ['YPS_' + name];
	var json = JSON.stringify(data, null, 2);
	var req = [];
	req.push('### ' + name);
	req.push(msg.concat(json.split('¥n')));
	chrome.runtime.sendMessage({appendData: req});
}

//------------------------------------------------------------------------
// 母港画面表示.
//
function print_port() {
	var req = [request_date_time()];
	var unlock_names = [];
	var lock_condlist = {};
	var lock_kyoukalist = { 0:[], 1:[], 2:[], 3:[], 4:[] };
	var lock_beginlist = {};
	var lock_standby = {};
	var lock_repairlist = [];
	var unowned_names = [];
	var owned_ship_idset = {};
	$locked_ship_idset = {};
	var newship = 0;
	var cond85 = 0;
	var cond53 = 0;
	var cond50 = 0;
	var unlock_lv10 = 0;
	var damage_H = 0;
	var damage_M = 0;
	var damage_L = 0;
	var damage_N = 0;
	var kaizou_list = [];
	var convert_list = [];
	var afterlv_list = [];
	var lockeditem_list = {};
	var lockeditem_count = 0;
	var $unlock_slotitem = 0;
	var $levelmax_slotitem = 0;
	var $leveling_slotitem = 0;
	var drumcan_cond85 = [];
	var drumcan_cond53 = [];
	var drumcan_cond50 = [];
	var drumcan_condxx = [];
	var sally_area = {};
	const weekly = get_weekly();
	//
	// ロック装備を種類毎に集計する.
	for (var id in $slotitem_list) {
		var value = $slotitem_list[id];
		if (value && value.locked) {
			var i = value.item_id;
			var lv = value.level;
			if (value.alv >= 1) lv += value.alv * 16; // levelは1～10なので16の下駄を履く.
			if (!lockeditem_list[i])
				lockeditem_list[i] = [];
			if (!lockeditem_list[i][lv])
				lockeditem_list[i][lv] = {count:0, shiplist:[]};
			lockeditem_list[i][lv].count++;
			lockeditem_count++;
		}
		if (value && value.level) {
			if (value.level >= 10)
				$levelmax_slotitem++;
			else
				$leveling_slotitem++;
		}
	}
	//
	// ロック艦のcond別一覧、未ロック艦一覧、ロック装備持ち艦を検出する.
	for (var id in $ship_list) {
		var ship = $ship_list[id];
		var begin_id = ship.begin_shipid();
		owned_ship_idset[begin_id] = true;
		if (!ship.locked) {
			var n = count_unless(ship.slot, -1); // スロット装備数.
			$unlock_slotitem += n;
			var name = ship.fleet_name_lv();
			if (n > 0) name += "*"; // 装備持ちなら、名前の末尾に"*"を付ける.
			if (ship.lv >= 10) { // Lv10以上なら、名前を強調表示し、警告カウントを上げる.
				unlock_lv10++;
				name = '@!!' + name + '!!@';
			}
			else if (ship.lv == 1 && !$locked_ship_idset[begin_id]) { // 新規艦を強調表示する.
				newship++;
				name = '@!!New★' + name + '!!@';
			}
			unlock_names.push(name);
		}
		else {	// locked
			$locked_ship_idset[begin_id] = true;
			var cond = ship.c_cond;
			array_push(lock_condlist, cond, ship);
			if      (cond >= 85) cond85++; // 三重キラ.
			else if (cond >= 53) cond53++; // 回避向上キラ.
			else if (cond >  49) cond50++; // キラ.
			var max_k = ship.max_kyouka();
			for (var i in max_k) {
				if (max_k[i] > ship.kyouka[i]) array_push(lock_kyoukalist, i, ship);
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
			array_push(lock_beginlist, begin_id, ship);
			let days = weekly.daily - ship.sortie_dn;
			if      (days <= 10) array_push(lock_standby, days, ship);
			else if (days <= 90) array_push(lock_standby, Math.ceil(days/10)*10, ship);
			else                 array_push(lock_standby, '不明(90日以上)', ship);
		}
		if (ship.slot) {
			ship.slot.forEach(function(id) {
				var value = $slotitem_list[id];
				if (value && value.locked) {
					var lv = value.level;
					if (value.alv >= 1) lv += value.alv * 16; // levelは1～10なので16の下駄を履く.
					lockeditem_list[value.item_id][lv].shiplist.push(ship);
				}
			});
		}
		if (ship.can_kaizou()) {
			if (ship.can_convert()) {
				convert_list.push(ship);
			} else {
				kaizou_list.push(ship);
			}
		} else if (ship.locked && ship.will_kaizou()) {
			afterlv_list.push(ship);
		}
		if (ship.sally_area) {
			if (sally_area[ship.sally_area]) {
				sally_area[ship.sally_area].push(ship);
			} else {
				sally_area[ship.sally_area] = [ship];
			}
		}
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
		, '\t週間収支'
		, '\t今回収支'
		, '\t==任務'
		, '\t==遠征'
		, '\t==道中'
		, '\t==自然+轟沈'
		, '\t==補給'
		, '\t==入渠'
		, '\t==建造+改造'
		, '\t==解体'
		, '\t==開発'
		, '\t==改修'
		, '\t==破棄'
	];
	for (var i = 0; i < 8; ++i) {
		var j = 1;
		msg[j++] += '\t==' + material_name(i + 1);
		msg[j++] += '\t  ' + $material.now[i];
		msg[j++] += '\t  ' + ($material.now[i] - weekly.monday_material[i]);
		msg[j++] += '\t  ' + ($material.now[i] - $material.beg[i]);
		msg[j++] += '\t  ' + $material.quest[i];
		msg[j++] += '\t  ' + $material.mission[i];
		msg[j++] += '\t  ' + $material.dropitem[i];
		msg[j++] += '\t  ' + $material.autosupply[i];
		msg[j++] += '\t  ' + $material.charge[i];
		msg[j++] += '\t  ' + $material.ndock[i];
		msg[j++] += '\t  ' + $material.createship[i];
		msg[j++] += '\t  ' + $material.destroyship[i];
		msg[j++] += '\t  ' + $material.createitem[i];
		msg[j++] += '\t  ' + $material.remodelslot[i];
		msg[j++] += '\t  ' + $material.destroyitem[i];
	}
	msg.push('---');
	req.push(msg);
	if ($log_daily != weekly.daily) {
		// 起動直後と毎朝5:00に、資源値をログ記録する.
		$log_daily = weekly.daily;
		push_to_logbook(msg[2].replace(/現在値/, $pcDateTime.toLocaleString() + ' 資材値:'));	// 日付+現在値.
	}
	//
	// 艦娘保有数、未ロック艦一覧、未保有艦一覧、ダブリ艦一覧を表示する.
	var ships = Object.keys($ship_list).length;
	var space = $max_ship - ships;
	if (space <= 0)      req.push('### @!!艦娘保有数が満杯です!!@'); // 警告表示.
	else if (space <= 5) req.push('### @!!艦娘保有数の上限まで残り' + space + '!!@'); // 警告表示.
	if (unlock_lv10) req.push('### @!!Lv10以上の未ロック艦があります!!@'); // 警告表示.
	if (newship) req.push('### @!!未ロックの新規艦があります!!@'); // 警告表示.
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
	msg.push('## ロック艦待機日数');
	for (let days in lock_standby) {
		let a = lock_standby[days];
		let title = '### 不明';
		if (days == 0)
			title = '### 当日';
		else if (days > 0)
			title = '### ' + days + '日以内';
		else if (days != null)
			title = '### ' + days;
		msg.push(title, '\t|' + shiplist_names(a));
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
		+ ', 改修中:' + $leveling_slotitem
		+ ', 改修max:' + $levelmax_slotitem + ')');
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
		msg.push('\t==分類\t==装備名\t==個数\t==使用艦名'); // 表ヘッダ.
		var category = -1;
		lockeditem_ids.forEach(function(id) {
			var cat = $mst_slotitem[id].api_type[2];
			if (cat != category) {
				msg.push('\t==' + $mst_slotitemeq[category = cat].api_name);
			}
			for (var lv in lockeditem_list[id]) {
				var item = lockeditem_list[id][lv];
				var level = lv % 16;
				var alv = (lv - level) / 16;
				msg.push('\t\t' + slotitem_name(id, level, alv) + '\t' + item.shiplist.length + '/' + item.count + '\t|' + shiplist_names(item.shiplist));
			}
		});
		msg.push('---');
		req.push(msg);
	}
	//
	// 改造可能一覧、近代化改修一可能覧を表示する.
	if ($kaizou_list_orig == null) $kaizou_list_orig = kaizou_list;
	if ($kaizou_list_orig.length < kaizou_list.length) req.push('### @!!改造可能艦が増えました!!@'); // 警告表示.
	if ($convert_list_orig == null) $convert_list_orig = convert_list;
	if ($convert_list_orig.length < convert_list.length) req.push('### @!!コンバート改装可能艦が増えました!!@'); // 警告表示.
	req.push('改造可能艦数:' + (kaizou_list.length + convert_list.length)
			+ ', 近代化改修可能艦数('
			+   '火力:' + lock_kyoukalist[0].length
			+ ', 雷装:' + lock_kyoukalist[1].length
			+ ', 装甲:' + lock_kyoukalist[3].length
			+ ', 対空:' + lock_kyoukalist[2].length
			+ ', 運:'   + lock_kyoukalist[4].length
			+ ')');
	var msg = ['YPS_kai_list'];
	if (afterlv_list.length > 0) msg.push('## 次の改造レベル', '\t|' + shiplist_names(afterlv_list, 'fleet_name_lv_afterlv'));
	if (kaizou_list.length > 0) msg.push('## 改造可能艦一覧', '\t|' + shiplist_names(kaizou_list));
	if (convert_list.length > 0) msg.push('## コンバート改装可能艦一覧', '\t|' + shiplist_names(convert_list));
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
	// お札のついた艦を表示する.
	var sally_area_list = Object.keys(sally_area);
	if (sally_area_list.length > 0) {
		var msg = ['YPS_sally_area'];
		msg.push('\t==札\t==艦名'); // 表ヘッダ
		var title = [];
		for (var area of sally_area_list) {
			title.push(event_sally_tag_name(area) + '(' + sally_area[area].length + ')');
			msg.push('\t' + event_sally_tag_name(area) + '\t|' + shiplist_names(sally_area[area]));
		}
		req.push('イベント札情報: ' + title.join(', '));
		msg.push('---');
		req.push(msg);
	}
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
				msg.push('\t' + ship.fleet_name_lv()
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
				msg.push('\t' + ship.fleet_name_lv()
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
		msg.push('---');
	}
	//
	// 遂行中任務を一覧表示する.
	if (weekly.practice_done < 5) req.push('### @!!演習可能です(' + weekly.practice_done + '/5)!!@' ); // 警告表示.
	push_quests(req);
	//
	// 各艦隊の情報を一覧表示する.
	push_all_fleets(req);
	chrome.runtime.sendMessage(req);
}

//------------------------------------------------------------------------
// 羅針盤・陣形選択画面表示.
//
function print_next(title, msg) {
	var req = [request_date_time()];
	req.push('# ' + map_name() + ' ' + title);
	req = req.concat(msg); // msg は string or Array.
	req.push('---');
	push_quests(req);
	push_all_fleets(req);
	if (req.damage_H_alart) { req.splice(1, 0, '# @!!【大破進撃警告】!!@ ダメコン未装備なら、ブラウザを閉じて進撃中止を勧告します.'); } // 大破進撃の警告を2行目に挿入する.
	chrome.runtime.sendMessage(req);
}

//------------------------------------------------------------------------
// 海域選択画面表示.
//
function print_mapinfo(uncleared, air_base) {
	var req = ["# 海域選択"];
	if (uncleared.length > 0) {
		var msg = ['YPS_uncleared_mapinfo'];
		msg = msg.concat(uncleared);
		req.push('未クリア海域');
		req.push(msg);
		msg.push('---');
	}
	if (air_base.length > 0) {
		req.push('基地航空隊');
		air_base.push('---');
		req.push(air_base);
	}
	push_quests(req);
	push_all_fleets(req);
	chrome.runtime.sendMessage(req);
}

//------------------------------------------------------------------------
// 装備改修工廠画面表示.
//
function print_remodel_slotlist(list) {
	var req = ['## 本日の改修工廠',
		'\t==分類\t==装備\t==二番艦\t==燃料/弾薬/鋼材/ボーキ'
		+'\t==開発/改修/消費装備'
		+'\t==★+6開発/改修/消費装備'
		+'\t==★max開発/改修/消費装備'
	];
	var list_ids = Object.keys(list);
	list_ids.sort(function(a, b) {	// 改修レシピID配列を装備分類順に並べ替える.
		a = $remodel_slotlist[a]; a = a.api_slot_id;
		b = $remodel_slotlist[b]; b = b.api_slot_id;
		var aa = $mst_slotitem[a];
		var bb = $mst_slotitem[b];
		var ret = aa.api_type[2] - bb.api_type[2]; // 装備分類の大小判定.
		if (!ret) ret = aa.api_sortno - bb.api_sortno; // 分類内の大小判定.
		// if (!ret) ret = a - b; // 種別ID値での大小判定.
		return ret;
	});
	var category = -1;
	list_ids.forEach(function(id) {
		var data = $remodel_slotlist[id];
		var cat = $mst_slotitem[data.api_slot_id].api_type[2];
		if (cat != category) {
			req.push('\t==' + $mst_slotitemeq[category = cat].api_name);
		}
		var subship = (id == 101 || id == 201 || id == 301 || id == 306) ? '---' : ship_name(list[id]);
		var msg = '\t\t|' + slotitem_levellist(data.api_slot_id).join(', ');
		msg += '\t' + subship;
		msg += '\t' + data.api_req_fuel;
		msg += '/'  + data.api_req_bull;
		msg += '/'  + data.api_req_steel;
		msg += '/'  + data.api_req_bauxite;
		msg += '\t' + remodel_req_kits_name(data)         + remodel_req_slot_name(data);
		msg += '\t' + remodel_req_kits_name(data.my_lv6)  + remodel_req_slot_name(data.my_lv6);
		msg += '\t' + remodel_req_kits_name(data.my_lv10) + remodel_req_slot_name(data.my_lv10);
		req.push(msg);
	});
	chrome.runtime.sendMessage(req);

}

function remodel_req_kits_name(data) {
	if (!data || data.api_req_remodelkit == null) return ''; // 戦闘糧食ではremodelkit==0なので、!remodelkit では判定できない.
	return data.api_req_buildkit + '/' + data.api_req_remodelkit;
}

function remodel_req_slot_name(data) {
	if (!data || !data.api_req_slot_num) return '';
	return '/' + slotitem_name(data.api_req_slot_id) + 'x' + data.api_req_slot_num;
}

function slotitem_levellist(mstid) {
	var count = {};
	var basename = slotitem_name(mstid);
	for (var id in $slotitem_list) {
		var value = $slotitem_list[id];
		if (value.item_id == mstid) {
			var name = slotitem_name(value.item_id, value.level, value.alv);
			if (count[name] == null)
				count[name] = 1;
			else
				count[name]++;
		}
	}
	var list = Object.keys(count).sort();
	for (var i = 0; i < list.length; ++i) {
		list[i] += ' x' + count[list[i]];
		if (i > 0) list[i] = list[i].substr(basename.length); // remove duplicated basename
	}
	if (list.length == 0) list.push(basename);
	return list;
}

//------------------------------------------------------------------------
function push_quests(req) {
	let quests = 0;
	let msg = ['YPS_quest_list'];
	let clear = ['YPS_quest_clear'];
	let q_count = { daily:0, weekly:0, monthly:0, others:0 };
	let p_count = { daily:0, weekly:0, monthly:0, others:0 };
	const w = get_weekly();
	for (var id in $quest_list) {
		var quest = $quest_list[id];
		var q_type = '';
		switch (quest.api_type) {
		case 1:	// デイリー.
			if (quest.yps_daily != w.daily) continue; // 期限切れ任務を非表示とする.
			if (quest.api_state > 1) p_count.daily++;
			if (!quest.yps_clear)    q_count.daily++;
			q_type = '(日)'; break;
		case 2:	// ウィークリー.
			if (quest.yps_week != w.week) continue; // 期限切れ任務を非表示とする.
			if (quest.api_state > 1) p_count.weekly++;
			if (!quest.yps_clear)    q_count.weekly++;
			q_type = '(週)'; break;
		case 3:	// マンスリー.
			if (quest.yps_month != w.month) continue; // 期限切れ任務を非表示とする.
			if (quest.api_state > 1) p_count.monthly++;
			if (!quest.yps_clear)    q_count.monthly++;
			q_type = '(月)'; break;
		case 4:	// 単発.
			q_type = '(単)'; break;
		case 5:	// 他.
			if (month_to_quarter(quest.yps_month) != month_to_quarter(w.month)) continue; // 期限切れ任務を非表示とする.
			if (id == 211 && quest.yps_daily != w.daily) continue;	// 期限切れの"空母3隻撃破"任務を非表示とする.
			if (id == 212 && quest.yps_daily != w.daily) continue;	// 期限切れの"輸送艦5隻撃破"任務を非表示とする.
			if (quest.api_state > 1) p_count.others++;
			if (!quest.yps_clear)    q_count.others++;
			q_type = '(他)'; break;
		}
		if (quest.api_state > 0) quests++;
		if (quest.api_state > 1) {
			var progress = (quest.api_state == 3) ? '* 達成!!'
				: (quest.api_progress_flag == 2) ? '* 遂行80%'
				: (quest.api_progress_flag == 1) ? '* 遂行50%'
				: '* 遂行中';
			var title = quest.api_title;
			if (quest.api_no == 214) title += weekly_name();
			msg.push(progress + ':' + q_type + title);
			msg.push(['tooltip'].concat(quest.api_detail.split('<br>')));
		}
		else if (quest.yps_clear) {
			quest.yps_clear = to_date(quest.yps_clear); // load_storage() で復帰した値は Date ではなく string なので、Date へ戻す.
			if (quest.api_type == 4 && quest.yps_clear.getTime() + 7*24*3600*1000 < Date.now()) continue; // 単発任務はクリア後7日経過したら非表示とする.
			clear.push('* ' + quest.yps_clear.toLocaleString() + ':' + q_type + quest.api_title);
		}
	}
	if (quests != $quest_count) req.push("### @!!任務リスト(全All)を先頭から最終ページまでめくって、内容を更新してください!!@");
	if (msg.length > 1) {
		req.push('任務遂行数:' + $quest_exec_count + '/' + $quest_count
			+ '(日:'  + p_count.daily   + '/' + q_count.daily
			+ ', 週:' + p_count.weekly  + '/' + q_count.weekly
			+ ', 月:' + p_count.monthly + '/' + q_count.monthly
			+ ', 他:' + p_count.others + '/' + q_count.others
			+ ')'
			);
		req.push(msg);
		if (clear.length > 1) {
			msg.push('クリア済', clear);
		}
		msg.push('---');
	}
}

function push_all_fleets(req) {
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
			req.push('## ' + combined_name() + ': ' + deck.api_name + ' + ' + deck2.api_name + ' (' + brief + ')');
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
			var ms = d.getTime() - $pcDateTime.getTime();
			var rest = ms > 0 ? '残' + msec_name(ms) : '終了';
			var id = deck.api_mission[1];
			req.push('遠征' + id + ' ' + $mst_mission[id].api_name + ': ' + d.toLocaleString() + '(' + rest + ')');
			$last_mission[f_id] = '前回遠征: ' + $mst_mission[id].api_name; // 支援遠征では /api_req_mission/result が来ないので、ここで事前更新しておく.
		}
		else if (deck.api_id == $battle_deck_id) {
			req.push('出撃中: ' + map_name());
			push_listform(req, $battle_log);
			if (/大破!!!/.test(brief)) { req.damage_H_alart = true; } // 大破進撃警告ON.
		}
		else {
			var m = $last_mission[f_id];
			if (m instanceof Array)
				m.forEach(function(a) { req.push(a); });
			else if (m)
				req.push(m);
			else
				req.push('母港待機中');
		}
	}
}

//------------------------------------------------------------------------
// イベントハンドラ.
//
function on_mission_check(category) {
	let quests = 0;
	var req = ['## 任務'];
	const w = get_weekly();
	for (var id in $quest_list) {
		var quest = $quest_list[id];
		if (quest.api_state > 0) quests++;
		if (quest.api_category == category || category == null) {	// 1:編成, 2:出撃, 3:演習, 4:遠征, 5:補給入渠, 6:工廠.
			let percent = (quest.api_progress_flag == 2) ? '80%'
						: (quest.api_progress_flag == 1) ? '50%'
						: null;
			let progress = (quest.api_state == 3) ? '達成!!'
						: (quest.api_state == 2) ? '遂行' + (percent || '中')
						: (quest.api_state == 1) ? '@!!未チェック' + (percent || '') + '!!@'
						: '@!!??!!@';
			if (quest.yps_clear) progress = 'クリア済';
			let q_type = '';
			switch (quest.api_type) {
			case 1:	// デイリー.
				if (quest.yps_daily != w.daily) continue; // 期限切れ任務を非表示とする.
				q_type = '(日)'; break;
			case 2:	// ウィークリー.
				if (quest.yps_week != w.week) continue; // 期限切れ任務を非表示とする.
				q_type = '(週)'; break;
			case 3:	// マンスリー.
				if (quest.yps_month != w.month) continue; // 期限切れ任務を非表示とする.
				q_type = '(月)'; break;
			case 4:	// 単発.
				q_type = '(単)'; break;
			case 5:	// 他.
				if (month_to_quarter(quest.yps_month) != month_to_quarter(w.month)) continue; // 期限切れ任務を非表示とする.
				if (id == 211 && quest.yps_daily != w.daily) continue;	// 期限切れの"空母3隻撃破"任務を非表示とする.
				if (id == 212 && quest.yps_daily != w.daily) continue;	// 期限切れの"輸送艦5隻撃破"任務を非表示とする.
				q_type = '(他)'; break;
			}
			req.push('\t' + progress + '\t' + id + ':' + q_type + quest.api_title);
		}
	}
	if (quests != $quest_count) req.unshift("### @!!任務リスト(全All)を先頭から最終ページまでめくって、内容を更新してください!!@");
	if (req.length > 1) {
		push_all_fleets(req);
		chrome.runtime.sendMessage(req);
	}
}

function on_next_cell(json) {
	var d = json.api_data;
	var g = json.api_data.api_itemget;
	if (d.api_itemget_eo_comment) g = [d.api_itemget_eo_comment]; // EO 1-6 海域ゴールの取得資源.
	var h = json.api_data.api_happening;
	var area = d.api_maparea_id + '-' + d.api_mapinfo_no + '-' + d.api_no;
	$next_mapinfo = $mst_mapinfo[d.api_maparea_id * 10 + d.api_mapinfo_no];
	$is_next = (d.api_next > 0);
	if (d.api_event_id == 5) {
		area += '(boss)';
		$is_boss = true;
	}
	if (g) {	// 資源マス.
		var msg = area;
		if (g.api_id) g = [g];	// 航空偵察マスの時は配列ではない.
		for (var i = 0; i < g.length; ++i) {
			var item = g[i];
			var id = item.api_id;
			var count = item.api_getcount;
			$material.dropitem[id-1]   += count;	// 道中ドロップによる資材増加を記録する.
			$material.autosupply[id-1] -= count;	// 後続の /api_port/port にて自然増加に誤算入される分を補正する.
			msg += (i == 0 ? ':' : ', ') + material_name(id) + 'x' + count;
			if (d.api_event_id == 7) msg += "(航空偵察)";	// 航空偵察マスの資源はboss戦勝利により獲得が確定する.　獲得失敗時は自然増加の減少として扱う.
		}
		$battle_log.push(msg);
		print_next('next item' + boss_next_name(), msg);
	}
	else if (h) {	// 渦潮マス.
		var id = h.api_mst_id;
		var count = h.api_count;
		$material.dropitem[id-1] -= count;	// 道中ロスによる資材減少を記録する.
		$material.charge[id-1]   += count;	// 後続の /api_req_hokyu/charge にて補給に含まれる分を補正する.
		var msg = area + ':' + material_name(id) + 'x' + -count;
		if (h.api_dentan) msg += '(電探により軽減あり)';
		$battle_log.push(msg);
		print_next('next loss' + boss_next_name(), msg);
	}
	else if (d.api_event_id == 1 || d.api_event_id == 6) {	// 非戦闘マス.
		var msg = area;
		msg += ':' + event_kind_name(d.api_event_kind);
		$battle_log.push(msg);
		print_next('next skip' + boss_next_name(), msg);
	}
	else if (d.api_event_id == 9) {	// 揚陸地点マス.
		var msg = area;
		msg += ':揚陸地点';
		$battle_log.push(msg);
		print_next('next event' + boss_next_name(), msg);
	}
	else {	// 戦闘マス.
		var req = [area];
		var db = $enemy_db[$next_enemy = area];
		if (db) {
			req[0] += ':敵遭遇回数記録';
			req.push('\t==今週\t==通算\t==艦隊名(陣形):編成\t==司令部Lv');
			if (db.fifo || db.data[0].r == null) { // 旧データならば破棄する.
				delete db.fifo;
				db.data = [];
			}
			var week = get_weekly().week;
			if (db.week != week) {
				db.week = week;
				db.data.forEach(function(a) { a.w = 0; }); // 今週回数をゼロに戻す.
			}
			var list = db.data.concat();
			list.sort(function(a, b) {	// 海域難度、今週、通算降順に並べ替える.
				if (a.r != b.r) return b.r - a.r;	// 海域難度が異なればその大小を返す.
				if (b.w != a.w) return b.w - a.w;	// 今週回数が異なればその大小を返す.
				return b.n - a.n;	// 通算回数の大小を返す.
			});
			var sum_ss = 0; // 敵潜水艦隊の通算回数合計.
			var sum_all = 0; //　全敵艦隊の通算回数合計.
			list.forEach(function(a) {
				var s = '\t  ' + a.w + '\t  ' + a.n + '\t|' + a.name + '\t' + a.lv;
				var ss = s.replace(/潜水.[級姫鬼]/g, '@!!$&!!@');
				if (s != ss) sum_ss += a.n;
				sum_all += a.n;
				ss = ss.replace(/輸送.級/g, '@!!$&!!@');
				ss = ss.replace(/空母.[級姫鬼]/g, '@!!$&!!@');
				ss = ss.replace(/軽母.[級姫鬼]/g, '@!!$&!!@');
				req.push(ss);
			});
			if (sum_ss > 0) {
				req.push('### @!!潜水艦注意!!@ ' + fraction_percent_name(sum_ss, sum_all));
			}
		}
		print_next('next enemy' + ($battle_count + 1) + boss_next_name() + ' ' + battle_kind_name(d.api_event_kind), req);
	}
}

/// 護衛退避艦リストに艦IDを追加する. idx = 1..6, 7..12
function add_ship_escape(idx) {
	if ($combined_flag) {
		if (idx >= 7)
			$ship_escape[$fdeck_list[2].api_ship[idx-7]] = 1; // 第ニ艦隊から退避.
		else if (idx >= 1)
			$ship_escape[$fdeck_list[1].api_ship[idx-1]] = 1; // 第一艦隊から退避.
	} else {
		$ship_escape[$fdeck_list[$battle_deck_id].api_ship[idx-1]] = 1; // 単艦退避
	}
}

function update_sortie_dn(deck_id) {
	const fdeck = $fdeck_list[deck_id];
	if (!fdeck) return;
	const weekly = get_weekly();
	for (let id of fdeck.api_ship) { // fdeck.api_ship.length は6 or 7. 艦隊が６隻以下の場合は -1 が埋草になっている.
		const ship = $ship_list[id];
		if (ship) ship.sortie_dn = weekly.daily;
	}
}

function make_debug_ship_names() {
	$debug_ship_names = [];
	let list = $fdeck_list[$battle_deck_id].api_ship;
	for (let id of list) { // list.length は6 or 7. 艦隊が６隻以下の場合は -1 が埋草になっている.
		let ship = $ship_list[id];
		$debug_ship_names.push(ship ? ship.name_lv() : null);
	}
	if (!$combined_flag) return;
	list = $fdeck_list[2].api_ship;
	for (let id of list) {
		let ship = $ship_list[id];
		$debug_ship_names.push(ship ? ship.name_lv() : null);
	}
}

/// 艦隊番号とLv付き艦名を生成する. idx = 0..5:第一艦隊, 6..11:第二艦隊. ae = 0/null/false:自軍, 1/true:敵軍. ff = 友軍艦隊情報.
function ship_name_lv(idx, ae, ff) {
	if (ae) {
		var d = $battle_api_data;
		if (idx >= 6) { // 敵護衛艦隊.
			var i = idx - 6;	// 6..12 => 0..5
			var s = '@!!(敵護衛' + (i+1) + ')!!@';
			if (d.api_ship_ke_combined) s += ship_name(d.api_ship_ke_combined[i]);
			if (d.api_ship_lv_combined) s +=    'Lv' + d.api_ship_lv_combined[i];
			return s;
		}
		else if (idx >= 0) { // 敵主力艦隊.
			var i = idx;	// 0..5
			return '@!!(敵' + (i+1) + ')!!@'
				+ ship_name(d.api_ship_ke[i])
				+    'Lv' + d.api_ship_lv[i];
		}
	}
	else {
		if (ff) { // 友軍艦隊.
			var i = idx;	// 0..5
			var s = '(友軍艦隊' + (i+1) + ')';
			var f = $battle_api_data.api_friendly_info;
			if (f.api_ship_id) s += ship_name(f.api_ship_id[i]);
			if (f.api_ship_lv) s +=    'Lv' + f.api_ship_lv[i];
			return s;
		}
		if ($combined_flag && idx >= 6) {
			let s = '(第二艦隊' + (idx-6+1) + ')';
			if ($debug_battle_json) return s + $debug_ship_names[idx];
			let fdeck = $fdeck_list[2];
			return s + $ship_list[fdeck.api_ship[idx-6]].name_lv();
		}
		else if (idx >= 0) {
			let s = '(主力艦隊' + (idx+1) + ')';
			if ($debug_battle_json) return s + $debug_ship_names[idx];
			let fdeck = $fdeck_list[$battle_deck_id];
			return s + $ship_list[fdeck.api_ship[idx]].name_lv();
		}
	}
	return ''; // idx: NaN, undefined, null, < 0
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
//	var lost  = d.api_lost_flag;
	var req = ['## battle result'];
  try {
	var drop_ship_name = g ? g.api_ship_type + ':' + g.api_ship_name : null;
	var drop_ship_log  = g ? g.api_ship_name : null;
	var drop_item_name = h ? $mst_useitem[h.api_useitem_id].api_name : null;
	if (g && !$locked_ship_idset[get_begin_shipid(g.api_ship_id)]) {
		drop_ship_name = '@!!New★' + drop_ship_name + '!!@';
		drop_ship_log  = '@!!New★' + drop_ship_log  + '!!@';
	}

	$escape_info = d.api_escape;	// on_goback_port()で使用する.
	if (e) {
		if ($next_mapinfo) {
			var map_rank = $mapinfo_rank[$next_mapinfo.api_id];
			if (map_rank) {		// 難度選択海域ならば、艦隊名に難度表記を付加する.
				e.api_deck_name += '@' + map_rank_name(map_rank);
			}
		}
		var rank = d.api_win_rank;
		var msg = e.api_deck_name;
		// api_req_practice/battle_result 「演習戦闘結果」JSONでは api_dests, api_destsf が存在しないので、推定計算の値を使う.
		var e_lost_count  = (d.api_dests != null) ? d.api_dests : $e_lost_count;
		var e_leader_lost = (d.api_destsf != null) ? d.api_destsf : $e_leader_lost;
		if (d.api_ship_id) {
			var total = count_unless(d.api_ship_id, -1);
			msg += '(' + e_lost_count + '/' + total + ')';
			if (rank == 'S' && $f_damage == 0) rank = '完S';
		}
		req.push(msg + ':' + rank);
//		$guess_info_str += ', f_lost:' + count_if(lost, 1); // 自轟沈数.
		$guess_info_str += ', e_lost:' + (e_leader_lost ? 'x' : '') + e_lost_count; // 敵撃沈数.
		$guess_info_str += ', rank:' + rank;
		if (rank != $guess_win_rank) {
			$guess_info_str += '/' + $guess_win_rank + ' MISS!!';
			req.push('### @!!勝敗推定ミス!!@ ' + $guess_info_str);
			push_to_logbook($next_enemy + ', ' + $guess_info_str);
		}
		else if ($guess_debug_log) {
			push_to_logbook($next_enemy + ', ' + $guess_info_str);
		}
		var log = $next_enemy + '(' + e.api_deck_name + '):' + $battle_info + ':' + rank;
		if (drop_ship_name) {
			log += '+' + drop_ship_log; // drop_ship_name; 艦種を付けると冗長すぎるので艦名のみとする.
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
				w: 1,					// 今週回数.
				n: 1,					// 通算回数.
				r: (map_rank || 0),		// 海域難度. 3(甲),2(乙),1(丙),0(通常) undefinedなら0に置き換える.
				lv: d.api_member_lv		// 司令部Lv.
			};
			for (var i = 0; i < db.data.length; ++i) {		// db.dataに記録済みならば、その記録を更新する.
				if (db.data[i].name == efleet.name) {
					efleet.n += db.data[i].n;
					efleet.w += db.data[i].w;
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
	if (mvp > 0) {
		var id = $fdeck_list[$battle_deck_id].api_ship[mvp-1];
		var ship = $ship_list[id];
		req.push('MVP: ' + ship.name_lv() + ' +' + d.api_get_ship_exp[mvp] + 'exp');
	}
	if (mvp_c > 0) {
		var id = $fdeck_list[2].api_ship[mvp_c-1];
		var ship = $ship_list[id];
		req.push('MVP: ' + ship.name_lv() + ' +' + d.api_get_ship_exp_combined[mvp_c] + 'exp');
	}
	if (d.api_landing_hp) {
		var p = d.api_landing_hp;
		var s = p.api_now_hp - p.api_sub_value;
		s = s > 0 ? fraction_percent_name(s, p.api_max_hp) : '達成';
		req.push('TP: ' + p.api_sub_value + ' => ' + s);
	}
	if (drop_ship_name) {
		req.push('## drop ship', drop_ship_name);
	}
	if (drop_item_name) {
		req.push('## drop item', drop_item_name);
	}
  } catch (ex) {
	req.push('# @!!' + ex.toString() + '!!@');
	console.error(ex);
  } finally {
	chrome.runtime.sendMessage({ appendData: req });
  }
}

function calc_damage(result, title, battle, fhp, ehp, active_deck, ff) {
	// fhp ::= [friend1..N] 0base, if 2nd fleet exists, "fhp.has2nd == true" and "fhp.idx2nd > 0".
	// ehp ::= [enemy1..N] 0base,  if 2nd fleet exists. "ehp.has2nd == ttue" and "ehp.idx2nd > 0".
	// active_deck[0] ::= active friend fleet: 1:1st, 2:2nd, 3:1st and 2nd.
	// active_deck[1] ::= active enemy  fleet: 1:1st, 2:2nd, 3:1st and 2nd.
	// !active_deck   ::= normal 6vs6, support attack, etc...
	// ff ::= 1:friendlyFleet
	if (!battle) return;
	var fidx = 0; if (active_deck && active_deck[0] == 2 && fhp.has2nd) fidx = fhp.idx2nd;
	var eidx = 0; if (active_deck && active_deck[1] == 2 && ehp.has2nd) eidx = ehp.idx2nd;
	result.detail.push({ title: '\t==' + title + '\t==攻撃艦\t==防御艦\t==命中\t==ダメージ\t==使用装備'});
	if (battle.api_df_list && battle.api_damage) {
		var df = battle.api_df_list;
		var ae = battle.api_at_eflag;
		for (var i = 0; i < df.length; ++i) {
			var si = battle.api_si_list[i]; // 装備配列.
			var cl = battle.api_cl_list[i]; // 命中配列.
			var ty = null;	// 攻撃種別.
			if (battle.api_at_type) ty = battle_type_name(battle.api_at_type[i], si);	// 昼戦攻撃種別.
			if (battle.api_sp_list) ty = battle_sp_name(battle.api_sp_list[i], si);		// 夜戦攻撃種別.
			for (var j = 0; j < df[i].length; ++j) {
				var target = df[i][j];
				if (target == -1) continue;
				var at = battle.api_at_list[i];
				var damage = battle.api_damage[i][j];
				// 砲撃戦:敵味方ダメージ集計.
				var target_hp = 0;
				if (ae[i] == 1) {
					target_hp = (fhp[target] -= Math.floor(damage));
				}
				else { // ae[i] == 0
					target_hp = (ehp[target] -= Math.floor(damage));
				}
				// 砲撃戦:敵味方砲撃詳報収集.
				var si2 = (/^連撃/.test(ty) && j < si.length) ? [si[j]] : si;
				result.detail.push({ty: ty, at: at, target: target, ae: ae[i], ff: ff, si: si2, cl: battle_cl_name(cl[j]), damage: damage, hp: target_hp});
			}
		}
	}
	var fhp_save = fhp.concat();
	var ehp_save = ehp.concat();
	if (battle.api_fdam) {
		// 航空戦/雷撃戦:自軍ダメージ集計.
		for (var i = 0; i < battle.api_fdam.length; ++i) {
			var dam = Math.floor(battle.api_fdam[i]);
			if (dam > 0) {
				var target = i + fidx; // if api_stage3_combined then fidx=6, else fidx=0
				fhp[target] -= dam;
			}
		}
	}
	if (battle.api_edam) {
		// 航空戦/雷撃戦:敵ダメージ集計.
		for (var i = 0; i < battle.api_edam.length; ++i) {
			var dam = Math.floor(battle.api_edam[i]);
			if (dam > 0) {
				var target = i + eidx; // if api_stage3_combined then eidx=6, else eidx=0
				ehp[target] -= dam;
			}
		}
	}
	if (battle.api_deck_id && battle.api_damage) { // battle: api_support_hourai
		for (var i = 0; i < battle.api_damage.length; ++i) {
			// 支援艦隊砲雷撃:敵ダメージ集計.
			var damage = battle.api_damage[i];
			if (damage == 0) continue;	// ダメージなしなら集計対象外とする.
			var target = i + eidx;
			if (ehp[target] <= 0) continue;	// 敵艦隊の編成外または撃沈済みなら集計対象外とする.
			var target_hp = (ehp[target] -= Math.floor(damage));
			// 支援艦隊砲雷撃:戦闘詳報収集.
			result.detail.push({ty:"支援砲雷撃", target: target, ae: 0, cl: battle_cl_name(battle.api_cl_list[i]), damage: damage, hp: target_hp});
		}
	}
	if (battle.api_frai) {
		// 自軍雷撃:戦闘詳報収集.
		for (var i = 0; i < battle.api_frai.length; ++i) {
			var target = battle.api_frai[i];
			var damage = battle.api_fydam[i];
			if (target >= 0) {
				var target_hp = (ehp_save[target] -= Math.floor(damage));
				var at = i + fidx;	///@todo check this
				result.detail.push({ty:"雷撃", at: at, target: target, ae: 0, cl: battle_cl_name(battle.api_fcl[i]), damage: damage, hp: target_hp});
			}
		}
	}
	if (battle.api_erai) {
		// 敵雷撃:戦闘詳報収集.
		for (var i = 0; i <= battle.api_erai.length; ++i) {
			var target = battle.api_erai[i];
			var damage = battle.api_eydam[i];
			if (target >= 0) {
				var target_hp = (fhp_save[target] -= Math.floor(damage));
				var at = i + eidx;	///@todo check this
				result.detail.push({ty:"雷撃", at: at, target: target, ae: 1, cl: battle_cl_name(battle.api_ecl[i]), damage: damage, hp: target_hp});
			}
		}
	}
	if (battle.api_frai_flag && battle.api_fbak_flag) {
		// 開幕航空戦:自軍被害詳報収集.
		for (var i = 0; i < battle.api_fdam.length; ++i) {
			var damage = battle.api_fdam[i];
			if (battle.api_frai_flag[i] || battle.api_fbak_flag[i]) {
				var target = i + fidx;
				var target_hp = (fhp_save[target] -= Math.floor(damage));
				result.detail.push({ty:"空爆", target: target, ae: 1, cl: battle_cl_name(damage ? battle.api_fcl_flag[i]+1 : 0), damage: damage, hp: target_hp});
			}
		}
	}
	if (battle.api_erai_flag && battle.api_ebak_flag) {
		// 開幕航空戦/航空支援:敵被害詳報収集.
		for (var i = 0; i < battle.api_edam.length; ++i) {
			var damage = battle.api_edam[i];
			if (battle.api_erai_flag[i] || battle.api_ebak_flag[i]) {
				var target = i + eidx;
				var target_hp = (ehp_save[target] -= Math.floor(damage));
				result.detail.push({ty: (battle.api_fdam ? "空爆" : "支援空爆"), target: target, ae: 0, cl: battle_cl_name(damage ? battle.api_ecl_flag[i]+1 : 0), damage: damage, hp: target_hp});
			}
		}
	}
	// 緊急ダメコン発動によるhp補正を行う.
	if (! /^演習/.test($next_enemy) && ! $debug_battle_json) {
		for (var i = 0; i < fhp.length; ++i) {
			if ($f_maxhps[i] == -1) continue;
			var sid = $fdeck_list[$battle_deck_id].api_ship[i];
			if (fhp.has2nd && i >= fhp.idx2nd) {
				sid = $fdeck_list[2].api_ship[i-fhp.idx2nd];
			}
			var ship = $ship_list[sid];
			if (ship && fhp[i] <= 0) {
				var id = slotitem_use(ship.slot, [42, 43]);	// slotの先頭から末尾に検索し、最初に見つけたダメコン装備を抜く.
				switch (id) {
				case 42: ship.repair_msg = '!!修理要員発動'; fhp[i] = Math.floor($f_maxhps[i] * 0.2); break; // 修理要員は 20% 回復する.
				case 43: ship.repair_msg = '!!修理女神発動'; fhp[i] = $f_maxhps[i]; break; // 修理女神は 100% 回復する.
				}
			}
		}
	}
}

function calc_kouku_damage(result, title, kouku, fhp, ehp) {
	if (!kouku) return;
	result.detail.push({ title: '\t==' + title + '\t==攻撃艦\t==防御艦\t==敵撃墜\t==被撃墜\t==使用装備'});
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
			result.detail.push({
				ty: '対空カットイン(' + st.api_air_fire.api_kind + ')',
				at: st.api_air_fire.api_idx,
				ae: 0,
				si: st.api_air_fire.api_use_items,
				ek: fraction_percent_name(st.api_e_lostcount, st.api_e_count),
				fk: fraction_percent_name(st.api_f_lostcount, st.api_f_count)
			});
		}
		else {
			result.detail.push({
				ty: '防空',
				ek: fraction_percent_name(st.api_e_lostcount, st.api_e_count),
				fk: fraction_percent_name(st.api_f_lostcount, st.api_f_count)
			});
		}
	}
	calc_damage(result, title, kouku.api_stage3, fhp, ehp);				// 航空爆撃雷撃戦.
	calc_damage(result, title, kouku.api_stage3_combined, fhp, ehp, [2,2]);	// 連合第二艦隊：航空爆撃雷撃戦.
}

function push_fdeck_status(req, fdeck, maxhps, nowhps, beginhps, idx, end) {
	req.push($debug_battle_json ? 'unknown' : fdeck.api_name);
	for (var i = idx; i < end; ++i) {
		if (maxhps[i] == -1) continue;
		var name = '?';
		if ($debug_battle_json) {
			name = $debug_ship_names[i];
			req.push('\t' + (i+1) + '(' + name + ').\t' + hp_status_on_battle(nowhps[i], maxhps[i], beginhps[i]));
			continue;
		}
		var ship = $ship_list[fdeck.api_ship[i-idx]];
		if (ship) {
			name = ship.name_lv();
			if (ship.repair_msg) name += ship.repair_msg;
			delete ship.repair_msg;
			var repair = slotitem_count(ship.slot, 42);	// 修理要員(ダメコン).
			var megami = slotitem_count(ship.slot, 43);	// 修理女神.
			if (repair) name += '+修理要員x' + repair;
			if (megami) name += '+修理女神x' + megami;
			req.push('\t' + (i+1) + '(' + name + ').\t' + hp_status_on_battle(nowhps[i], maxhps[i], beginhps[i]));
		}
	}
}

function guess_win_rank(f_nowhps, f_maxhps, f_beginhps, e_nowhps, e_maxhps, e_beginhps, battle_api_name) {
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
	for (var i = 0; i < f_maxhps.length; ++i) {
		// 友軍被害集計.
		if (f_maxhps[i] == -1) continue;
		var n = f_nowhps[i];
		++f_count;
		f_damage_total += f_beginhps[i] - Math.max(0, n);
		f_hp_total += f_beginhps[i];
		f_maxhp_total += f_maxhps[i];
		if (n <= 0) {
			++f_lost_count;
		}
	}
	for (var i = 0; i < e_maxhps.length; ++i) {
		// 敵艦被害集計.
		if (e_maxhps[i] == -1) continue;
		var n = e_nowhps[i];
		++e_count;
		e_damage_total += e_beginhps[i] - Math.max(0, n);
		e_hp_total += e_beginhps[i];
		if (n <= 0) {
			++e_lost_count;
			if(i == 0) e_leader_lost = true;
		}
	}
	$f_damage = f_damage_total;
	$e_lost_count = e_lost_count;
	$e_leader_lost = e_leader_lost;
	// %%% CUT HERE FOR TEST %%%
	var f_damage_percent = Math.floor(100 * f_damage_total / f_hp_total); // 自ダメージ百分率. 小数点以下切り捨て.
	var e_damage_percent = Math.floor(100 * e_damage_total / e_hp_total); // 敵ダメージ百分率. 小数点以下切り捨て.
	var rate = e_damage_percent == 0 ? 0   : // 潜水艦お見合い等ではDになるので敵ダメ判定を優先する.
			   f_damage_percent == 0 ? 100 : // ゼロ除算回避、こちらが無傷なら1ダメ以上与えていればBなのでrateを100にする.
			   e_damage_percent / f_damage_percent;
	$guess_info_str = 'f_damage:' + fraction_percent_name(f_damage_total, f_hp_total) + '[' + f_lost_count + '/' + f_count + ']' + f_maxhp_total
				+ ', e_damage:' + fraction_percent_name(e_damage_total, e_hp_total) + (e_leader_lost ? '[x' : '[') + e_lost_count + '/' + e_count + ']'
				+ ', api:' + battle_api_name
				+ ', rate:' + Math.round(rate * 10000) / 10000
				;
	$guess_debug_log = false;
	if (/ld_airbattle/.test(battle_api_name)) {
		$guess_debug_log = (f_lost_count != 0) // D/E判定検証.
			|| (f_damage_percent > 9 && f_damage_percent < 10) // A/B閾値検証.
			|| (f_damage_percent > 19 && f_damage_percent < 22) // B/C閾値検証.
			|| (f_damage_percent > 41) // C/D閾値検証.
			;
		if (f_damage_total == 0) return '完S'; // 確定.
		if (f_damage_percent < 10) return 'A'; // 確定. 自ダメージ 0.4%～9%　で A判定を確認済み.
		if (f_damage_percent < 20) return 'B'; // 要検証!!! 自ダメージ 10%～19%　で B判定を確認済み.
		if (f_damage_percent < 50) return 'C'; // 要検証!!! 自ダメージ 22%～41%　で C判定を確認済み.
		if (f_damage_percent < 80) return 'D'; // 要検証!!! 自ダメージ 76.1% で D判定を確認済み.
		return 'E';
	}
	if (e_count == e_lost_count && f_lost_count == 0) { // 確定. 敵全隻撃沈かつ、自轟沈なしならば、S勝利.
		return (f_damage_total == 0) ? '完S' : 'S';	// 1%未満の微ダメージでも、"完S"にはならない.
	}
	if (e_lost_count > 0 && e_lost_count >= Math.floor(e_count * 2 / 3) && f_lost_count == 0) { // 確定. 敵艦隊2/3隻(少数切り捨て)以上撃沈かつ、自轟沈なしならば、A勝利.
		return 'A';
	}
	if (e_leader_lost && f_lost_count < e_lost_count) {　// 検証中!!! 敵旗艦撃沈かつ、自轟沈数より敵撃沈数が多いならば、B勝利.
		return 'B';
	}
	if (f_count == 1 && (f_hp_total - f_damage_total) / f_maxhp_total <= 0.25) { // 検証中!!! 自艦隊単艦かつ旗艦大破ならば、D敗北.
		///@see https://github.com/andanteyk/ElectronicObserver/commit/80fc664e3d5c4223dd585882a726ecc719d15be8
		return 'D';
	}
	if (10 * e_damage_percent > 25 * f_damage_percent) { // 確定. 戦果ゲージ比が2.5より大きいならば、B勝利.
		return 'B';
	}
	if (10 * e_damage_percent > 9 * f_damage_percent) { // 確定. 戦果ゲージ比が0.9より大きいならば、C敗北.
		return 'C';
	}
	if (e_leader_lost || f_lost_count == 0 || f_count - f_lost_count > 1) {　// 検証中!!! 敵旗艦撃沈、または自轟沈なし、または自艦隊に旗艦以外の生存艦ありならば、D敗北.
		return 'D';
	}
	return 'E'; // 検証中!!! 上記以外、つまり敵旗艦生存かつ自艦隊旗艦以外轟沈ならば、E敗北.
}

function concat_2nd_at6(a, c, filler) {	///< a の複製を作り、c が存在すれば a[6]の位置にcを結合する. a[a.length..5] は filler で埋める.
	if (a == null) a = [];
	let r = a.concat();
	if (c) {
		r.length = 6;
		if (a.length < 6) r.fill(filler, a.length, 6);
		r = r.concat(c);
		r.has2nd = true;
		r.idx2nd = 6;
	}
	return r;
}

function concat_hps(a, c) {
	// 元のJSONデータを破壊しないようにするため、連合艦隊以外でも複製を作る.
	// 戦闘JSONデータの攻撃/防御の艦番号は、通常艦隊:0..5, 第三遊撃艦隊:0..6, 連合第一艦隊:0..5, 連合第二艦隊:6..11 である.
	// 連合第一艦隊の編成が5隻以下の場合は、hps[6]が連合第二艦隊の旗艦のHPを保持するように間に埋草を入れる.
	// guess_win_rank のダメージ集計時に埋草を除外するため maxhps の埋草は -1 でなければならない.
	return concat_2nd_at6(a, c, -1);
}

function on_battle(json, battle_api_name) {
	const req = [request_date_time()];
	const dbg = ['YPS_debug_battle',
		'```',
		'$debug_ship_names  = '+JSON.stringify($debug_ship_names),
		'$debug_battle_json = '+JSON.stringify(json),
		'$debug_api_name  = '+JSON.stringify(battle_api_name),
		'$f_beginhps      = '+JSON.stringify($f_beginhps),
		'$e_beginhps      = '+JSON.stringify($e_beginhps),
		'$e_prevhps       = '+JSON.stringify($e_prevhps),
		'$combined_flag   = '+JSON.stringify($combined_flag),
		'$battle_count    = '+JSON.stringify($battle_count),
		'$is_boss         = '+JSON.stringify($is_boss),
		'$is_next         = '+JSON.stringify($is_next),
		'$next_mapinfo    = '+JSON.stringify($next_mapinfo),
		'```'];
	req.push(dbg);
  try {
	var d = $battle_api_data = json.api_data;
	var f_maxhps = concat_hps(d.api_f_maxhps, d.api_f_maxhps_combined); // 通常艦隊[0..5], 増強第三艦隊[0..6], 第一/第二連合艦隊[0..5,6..11]
	var f_nowhps = concat_hps(d.api_f_nowhps, d.api_f_nowhps_combined);
	var f_beginhps = f_nowhps.concat();
	var e_maxhps = concat_hps(d.api_e_maxhps, d.api_e_maxhps_combined); // 敵通常艦隊[0..5], 敵主力/敵護衛連合艦隊[0..5,6..11]
	var e_nowhps = concat_hps(d.api_e_nowhps, d.api_e_nowhps_combined);
	var e_beginhps = e_nowhps.concat();
	var result = {
		seiku : null, 				// 制空権.
		touch : null,				// 触接.
		f_air_lostcount : 0,		// 非撃墜数.
		detail : []					// 戦闘詳報.
	};
	$f_maxhps = f_maxhps;
//	if (d.api_deck_id == null) d.api_deck_id = d.api_dock_id; // battleのデータは、綴りミスがあるので補正する. => fixed on Nov.2017.
	if (d.api_escape_idx) {
		d.api_escape_idx.forEach(function(idx) {
			f_maxhps[idx-1] = -1;	// 護衛退避した艦を艦隊リストから抜く. idx=1..6
		});
	}
	if (d.api_escape_idx_combined) {
		d.api_escape_idx_combined.forEach(function(idx) {
			f_maxhps[idx-1+f_maxhps.idx2nd] = -1;	// 護衛退避した艦を第二艦隊リストから抜く. idx=1..6
		});
	}
	// 友軍艦隊(NPC). @since 2018.Feb WinterEvent
	var ff = d.api_friendly_battle;
	var fi = d.api_friendly_info;
	if (ff && fi) {
		if ($e_prevhps) {
			e_nowhps = $e_prevhps; // e_nowhps には友軍艦隊攻撃後の敵ダメージが入っているので、昼戦終了時のダメージを初期値として使う.
			e_beginhps = e_nowhps.concat();
		}
		var t0 = ff.api_flare_pos[0]; if (t0 != -1) result.detail.push({ty:'友軍照明弾(夜戦)',   at: t0, ae: 0, ff: 1});
		calc_damage(result, "友軍艦隊", ff.api_hougeki, fi.api_nowhps.concat(), e_nowhps, null, 1);
	}
	if (d.api_touch_plane) {
		// 触接(夜戦).
		result.touch = d.api_touch_plane;
		var t0 = d.api_touch_plane[0]; if (t0 != -1) result.detail.push({ty:'触接(夜戦)',  si:[t0]});
		var t1 = d.api_touch_plane[1]; if (t1 != -1) result.detail.push({ty:'被触接(夜戦)', si:[t1]});
	}
	if (d.api_flare_pos) {
		// 照明弾発射(夜戦).
		var t0 = d.api_flare_pos[0]; if (t0 != -1) result.detail.push({ty:'照明弾(夜戦)',   at: t0, ae: 0});
		var t1 = d.api_flare_pos[1]; if (t1 != -1) result.detail.push({ty:'敵照明弾(夜戦)', at: t1, ae: 1});
	}
	// calc_damage() の呼び出し順序は、下記資料の戦闘の流れに従っている.
	// @see http://wikiwiki.jp/kancolle/?%C0%EF%C6%AE%A4%CB%A4%C4%A4%A4%A4%C6
	// @see http://wikiwiki.jp/kancolle/?%CF%A2%B9%E7%B4%CF%C2%E2
	var sinfo = d.api_n_support_info;
	var sflag = d.api_n_support_flag;
	if (sinfo) {
		switch (sflag) {
		case 1: case 4: // 航空支援、対潜支援哨戒.
			calc_damage(result, "夜戦" + support_name(sflag), sinfo.api_support_airatack.api_stage3, f_nowhps, e_nowhps); break;
		case 2: case 3: // 支援射撃、支援長距離雷撃.
			calc_damage(result, "夜戦" + support_name(sflag), sinfo.api_support_hourai,              f_nowhps, e_nowhps); break;
		}
	}
	calc_damage(result, "夜戦砲撃",         d.api_hougeki,    f_nowhps, e_nowhps, /*d.api_active_deck*/);	// 追撃夜戦.
	calc_damage(result, "夜戦砲撃(敵護衛)", d.api_n_hougeki1, f_nowhps, e_nowhps);	// ec_night_to_day: 6vs12払暁戦 夜戦砲撃(友軍 vs 敵護衛艦隊 対全体).
	calc_damage(result, "夜戦砲撃(敵主力)", d.api_n_hougeki2, f_nowhps, e_nowhps);	// ec_night_to_day: 6vs12払暁戦 夜戦砲撃(友軍 vs 敵主力艦隊 対全体).
	if (d.api_day_flag) {
		e_nowhps.has2nd = false; // Nov.2017 払暁戦の昼戦では敵護衛艦隊が撤退して敵本体のみとなる.
		///@todo e_maxhps[ehp.idx2nd...] = -1; would we need for guess_win_rank?
	}
	calc_kouku_damage(result, "噴式強襲(基地航空隊)", d.api_air_base_injection, f_nowhps, e_nowhps);
	calc_kouku_damage(result, "噴式強襲",             d.api_injection_kouku,    f_nowhps, e_nowhps);
	if (d.api_air_base_attack) {
		d.api_air_base_attack.forEach(function(kouku) {
			calc_kouku_damage(result, "基地航空隊支援", kouku, f_nowhps, e_nowhps);　// 2016.5
		});
	}
	calc_kouku_damage(result, "航空戦",  d.api_kouku,  f_nowhps, e_nowhps);
	calc_kouku_damage(result, "航空戦2", d.api_kouku2, f_nowhps, e_nowhps);
	var sinfo = d.api_support_info;
	var sflag = d.api_support_flag;
	if (sinfo) {
		switch (sflag) {
		case 1: case 4: // 航空支援、対潜支援哨戒.
			calc_damage(result, support_name(sflag), sinfo.api_support_airatack.api_stage3, f_nowhps, e_nowhps); break;
		case 2: case 3: // 支援射撃、支援長距離雷撃.
			calc_damage(result, support_name(sflag), sinfo.api_support_hourai,              f_nowhps, e_nowhps); break;
		}
	}
	calc_damage(result, "先制対潜", d.api_opening_taisen, f_nowhps, e_nowhps);	// 対潜先制爆雷攻撃.　2016-06-30メンテ明けから追加.
	calc_damage(result, "開幕雷撃", d.api_opening_atack,  f_nowhps, e_nowhps);	// 開幕雷撃.
	switch ($combined_flag) {
	default:// 不明.
	case 0: // 通常艦隊.
		if (e_nowhps.has2nd) { // 6vs12
			calc_damage(result, "砲撃戦(護衛)", d.api_hougeki1, f_nowhps, e_nowhps);	// 砲撃一巡目(友軍 vs 敵護衛艦隊).
			calc_damage(result, "雷撃戦(連合)", d.api_raigeki,  f_nowhps, e_nowhps);	// 雷撃戦(友軍からの攻撃対象は敵主力・護衛の双方).
			calc_damage(result, "砲撃戦(主力)", d.api_hougeki2, f_nowhps, e_nowhps);	// 砲撃二巡目(友軍 vs 敵主力艦隊).
			calc_damage(result, "砲撃戦(連合)", d.api_hougeki3, f_nowhps, e_nowhps);	// 砲撃三巡目(友軍からの攻撃対象は敵主力・護衛の双方).
		}
		else { // 6vs6 or 6vs12払暁昼戦.
			calc_damage(result, "砲撃戦1", d.api_hougeki1, f_nowhps, e_nowhps);	// 砲撃一巡目.
			calc_damage(result, "砲撃戦2", d.api_hougeki2, f_nowhps, e_nowhps);	// 砲撃二巡目.
			calc_damage(result, "砲撃戦3", d.api_hougeki3, f_nowhps, e_nowhps);	// 砲撃三巡目.
			calc_damage(result, "雷撃戦",  d.api_raigeki,  f_nowhps, e_nowhps);	// 雷撃戦.
		}
		break;
	case 1: // 連合艦隊(機動部隊).
	case 3: // 連合艦隊(輸送護衛部隊).
		if (e_nowhps.has2nd) { // 12vs12
			calc_damage(result, "第一砲撃戦(敵主力)", d.api_hougeki1, f_nowhps, e_nowhps);	// 第一艦隊砲撃(vs 敵主力).
			calc_damage(result, "第二砲撃戦(敵護衛)", d.api_hougeki2, f_nowhps, e_nowhps);	// 第二艦隊砲撃(vs 敵護衛).
			calc_damage(result, "第二雷撃戦(敵連合)", d.api_raigeki,  f_nowhps, e_nowhps);	// 第二艦隊雷撃戦(vs 敵主力+敵護衛).
			calc_damage(result, "第一砲撃戦(敵連合)", d.api_hougeki3, f_nowhps, e_nowhps);	// 第一艦隊砲撃(vs 敵主力+敵護衛).
		}
		else { // 12vs6
			calc_damage(result, "第二砲撃戦",  d.api_hougeki1, f_nowhps, e_nowhps);	// 第二艦隊砲撃.
			calc_damage(result, "第二雷撃戦",  d.api_raigeki,  f_nowhps, e_nowhps);	// 第二艦隊雷撃戦.
			calc_damage(result, "第一砲撃戦1", d.api_hougeki2, f_nowhps, e_nowhps);	// 第一艦隊砲撃一巡目.
			calc_damage(result, "第一砲撃戦2", d.api_hougeki3, f_nowhps, e_nowhps);	// 第一艦隊砲撃二巡目.
		}
		break;
	case 2: // 連合艦隊(水上部隊).
		if (e_nowhps.has2nd) { // 12vs12
			calc_damage(result, "第一砲撃戦(敵主力)", d.api_hougeki1, f_nowhps, e_nowhps);	// 第一艦隊砲撃(vs 敵主力).
			calc_damage(result, "第一砲撃戦(敵連合)", d.api_hougeki2, f_nowhps, e_nowhps);	// 第一艦隊砲撃(vs 敵主力+敵護衛).
			calc_damage(result, "第二砲撃戦(敵護衛)", d.api_hougeki3, f_nowhps, e_nowhps);	// 第二艦隊砲撃(vs 敵護衛).
			calc_damage(result, "第二雷撃戦(敵連合)", d.api_raigeki,  f_nowhps, e_nowhps);	// 第二艦隊雷撃戦(vs 敵主力+敵護衛).
		}
		else { // 12vs6
			calc_damage(result, "第一砲撃戦1", d.api_hougeki1, f_nowhps, e_nowhps);	// 第一艦隊砲撃一巡目.
			calc_damage(result, "第一砲撃戦2", d.api_hougeki2, f_nowhps, e_nowhps);	// 第一艦隊砲撃二順目.
			calc_damage(result, "第二砲撃戦",  d.api_hougeki3, f_nowhps, e_nowhps);	// 第二艦隊砲撃.
			calc_damage(result, "第二雷撃戦",  d.api_raigeki,  f_nowhps, e_nowhps);	// 第二艦隊雷撃戦.
		}
		break;
	}
	var fdeck = $fdeck_list[$battle_deck_id = d.api_deck_id];
	var fmt = null;
	if (d.api_formation) {
		fmt = formation_name(d.api_formation[0])
			+ '/' + match_name(d.api_formation[2])
			+ '/敵' + formation_name(d.api_formation[1]);
		if (d.api_friendly_info) fmt += '+友軍艦隊' + d.api_friendly_info.api_production_type;
		if (d.api_support_flag) fmt += '+' + support_name(d.api_support_flag);
		if (d.api_n_support_flag) fmt += '+' + support_name(d.api_n_support_flag);
		if (d.api_air_base_attack) fmt += '+基地航空隊';
		if (result.seiku != null) fmt += '/' + seiku_name(result.seiku);
		$enemy_formation = formation_name(d.api_formation[1]);
	}
	//
	// --- print out ----
	//
	req.push('# ' + map_name() + ' battle' + $battle_count);
	if (!/^演習/.test(map_name())) req.push(req.pop() + boss_next_name());
	req.push(req.pop() + ' ' + battle_api_kind_name(battle_api_name));
	push_listform(req, $battle_log);
	push_listform(req, $next_enemy);
	if (fmt) req.push(fmt);
	if (d.api_search) {
		req.push('索敵: ' + search_name(d.api_search[0])); // d.api_search[1] は敵索敵か??
	}
	if (result.touch) {
		var t0 = result.touch[0]; if (t0 != -1) req.push('触接中: ' + slotitem_name(t0));
		var t1 = result.touch[1]; if (t1 != -1) req.push('被触接中: ' + slotitem_name(t1));
	}
	if ($f_beginhps) {
		dbg.push('緒戦被害:' + $guess_info_str + ', 推定:' + $guess_win_rank);
		$battle_info += '/追撃';
		if (d.api_friendly_info) $battle_info += '+友軍艦隊' + d.api_friendly_info.api_production_type;
	} else {
		$battle_info = fmt;
	}
	if (!$f_beginhps) $f_beginhps = f_beginhps;
	if (!$e_beginhps) $e_beginhps = e_beginhps;
	if (!$e_prevhps)  $e_prevhps  = e_nowhps;
	$guess_win_rank = guess_win_rank(f_nowhps, f_maxhps, $f_beginhps, e_nowhps, e_maxhps, $e_beginhps, battle_api_name);
	dbg.push('戦闘被害:' + $guess_info_str);
	req.push('勝敗推定:' + $guess_win_rank);

	if (result.detail.length) {
		var msg = ['YPS_battle_detail'];
		for (var i = 0; i < result.detail.length; ++i) {
			var dt = result.detail[i];
			if (dt.title) {
				var dtnext = result.detail[i+1];	// 範囲外ならundef
				if (dtnext && dtnext.title) continue;	// タイトルのみで戦闘記録なしの場合（例：敵潜水艦のみの航空戦空爆）は、タイトルを除去する.
				msg.push(dt.title); continue;
			}
			if (dt.damage && dt.target != null) {
				var maxhps = dt.ae ? (dt.ff ? d.api_friendly_info.api_maxhps : f_maxhps) : e_maxhps;
				dt.damage += ':' + damage_name(dt.hp, maxhps[dt.target], Math.floor(dt.damage));
			}
			msg.push('\t' + dt.ty
				+ '\t' + ship_name_lv(dt.at, dt.ae, dt.ff)
				+ '\t' + ship_name_lv(dt.target, !dt.ae, dt.ff)
				+ '\t' + (dt.cl || dt.ek || "")	// 命中判定 または 敵撃墜率.
				+ '\t' + (dt.damage || dt.fk || "")	// ダメージ または 被撃墜率.
				+ '\t' + slotitem_names(dt.si)
			);
		}
		req.push('戦闘詳報');
		req.push(msg);
	}

	req.push('## friend damage');
	push_fdeck_status(req, fdeck, f_maxhps, f_nowhps, f_beginhps, 0, d.api_f_maxhps.length);
	if ($combined_flag) {
		push_fdeck_status(req, $fdeck_list[2], f_maxhps, f_nowhps, f_beginhps, f_nowhps.idx2nd, f_nowhps.length); // 連合第二艦隊は二番固定です.
	}
	req.push('被撃墜数: ' + result.f_air_lostcount);
	req.push('## enemy damage');
	$enemy_ship_names = [];
	let ship_ke = concat_2nd_at6(d.api_ship_ke, d.api_ship_ke_combined, -1);
	let ship_lv = concat_2nd_at6(d.api_ship_lv, d.api_ship_lv_combined, 0);
	let eSlot   = concat_2nd_at6(d.api_eSlot,   d.api_eSlot_combined,   null);
	let eParam  = concat_2nd_at6(d.api_eParam,  d.api_eParam_combined,  null);
	let eKyouka = concat_2nd_at6(d.api_eKyouka, d.api_eKyouka_combined, null);
	for (var i = 0; i < ship_ke.length; ++i) {
		var ke = ship_ke[i];
		if (ke == -1 || ke == null) continue;
		var name = ship_name(ke) + 'Lv' + ship_lv[i];
		$enemy_ship_names.push(name);
		req.push('\t' + (i+1) + '(' + name + ').\t'
			+ hp_status_on_battle(e_nowhps[i], e_maxhps[i], e_beginhps[i]));

		var msg = ['tooltip'];
		var enemy_slot = eSlot[i];
		var param_name = ['火力', '雷装', '対空', '装甲'];
		var enemy_param = eParam[i];
		var enemy_kyouka = eKyouka[i] || [0,0,0,0];
		var param = [];
		for(var j = 0; j < 4; ++j){
			param[j] = param_name[j] + ' ' + enemy_param[j] + diff_name(enemy_kyouka[j], 0);
		}
		msg.push('* ' + param.join(', '));
		for(var j = 0; j < enemy_slot.length; ++j){
			if(enemy_slot[j] > 0) {	// 2016夏イベントE-1　boss 潜水夏姫のslotの空き枠に-1のかわりに0が入っていたので、除外条件を変更した.
				msg.push('* ' + (j+1) + ': ' + slotitem_name(enemy_slot[j]));
			}
		}
		req.push(msg);
	}
  } catch (ex) {
	req.push('# @!!' + ex.toString() + '!!@');
	console.error(ex);
  } finally {
	if (!fdeck) return req; // for on-battle-test.html.
	chrome.runtime.sendMessage(req);
  }
}

chrome.devtools.network.onRequestFinished.addListener(function (request) {
	var func = null;
	var api_name = request.request.url.replace(/^http:\/\/[^\/]+\/kcsapi\//, '/');
	if (api_name == request.request.url) {
		// 置換失敗. api以外なので早抜けする.
		return;
	}
	// 時刻を得る.
	$svDateTime = $pcDateTime = to_date(request.startedDateTime);	// PC側の日時(POST).
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
			update_mst_slotitemeq(json.api_data.api_mst_slotitem_equiptype);
			update_mst_useitem(json.api_data.api_mst_useitem);
			update_mst_mission(json.api_data.api_mst_mission);
			update_mst_mapinfo(json.api_data.api_mst_mapinfo);
			update_mst_maparea(json.api_data.api_mst_maparea);
			sync_cloud();
			chrome.runtime.sendMessage("## ロード完了");
			debug_print_mst_slotitem();
			debug_print_newship_slots();
			debug_print_as_json($remodel_slotlist, 'remodel_slotlist');
			debug_print_as_json($remodel_slotweek, 'remodel_slotweek');
		};
	}
	else if (api_name == '/api_get_member/require_info') { // 2016.4 メンテで追加された.
		// ログイン直後の一覧表更新.
		func = function(json) { // 装備リストと建造リストを更新する.
			update_slotitem_list(json.api_data.api_slot_item);
			update_kdock_list(json.api_data.api_kdock);
		};
	}
	else if (api_name == '/api_get_member/slot_item') {
		// 保有装備一覧表.
		func = function(json) { // 保有する装備配列をリストに記録する.
			update_slotitem_list(json.api_data);
			if ($do_print_port_on_slot_item) {
				$do_print_port_on_slot_item = false;
				print_port();
			}
		};
	}
	else if (api_name == '/api_get_member/kdock') {
		// 建造一覧表(建造直後).
		func = function(json) { // 建造状況を更新する.
			update_kdock_list(json.api_data);
		};
	}
	else if (api_name == '/api_req_kousyou/createship') {
		// 艦娘建造.
		$material_sum = $material.createship;	// 消費資材は後続の /api_get_member/material パケットにて集計する.
		// 直後に /api_get_member/kdock と /api_get_member/material パケットが来るので print_port() は不要.
	}
	else if (api_name == '/api_req_kaisou/remodeling') {
		// 艦娘改造.
		$material_sum = $material.createship;	// 消費資材は後続の /api_get_member/material パケットにて集計する. 従来は$mst_ship[]から消費資材を得ていたが、翔鶴改二／改二甲の相互改造における開発資材(歯車)消費値が取れないので方法を変えた.
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
			if (ids) slotitem_delete(/,/.test(ids) ? ids.split(',') : [ids]);		// 破棄した装備を、リストから抜く.
			diff_update_material(json.api_data.api_get_material, $material.destroyitem);	// 装備破棄による資材増加を記録する.
			print_port();
		};
	}
	else if (api_name == '/api_req_kousyou/destroyship') {
		// 艦娘解体.
		func = function(json) {
			var dest = decode_postdata_params(request.request.postData.params).api_slot_dest_flag;
			var ids = decode_postdata_params(request.request.postData.params).api_ship_id;
			if (ids) ship_delete(/,/.test(ids) ? ids.split(',') : [ids], dest==0);	// 解体した艦娘を、リストから抜く.
			update_material(json.api_data.api_material, $material.destroyship); /// 解体による資材増加を記録する.
			print_port();
		};
	}
	else if (api_name == '/api_req_kaisou/powerup') {
		// 近代化改修.
		var ids = decode_postdata_params(request.request.postData.params).api_id_items;
		if (ids) ship_delete(/,/.test(ids) ? ids.split(',') : [ids]);		// 素材として使った艦娘が持つ装備を、リストから抜く.
		func = function(json) {
			var d = json.api_data;
			if (d.api_ship) delta_update_ship_list([d.api_ship]);
			if (d.api_deck) update_fdeck_list(d.api_deck);
			print_port();
		}
	}
	else if (api_name == '/api_req_kousyou/remodel_slotlist') {
		// 装備改修メニュー.
		func = function(json) {
			var ms = $svDateTime.getTime() - Date.UTC(2013, 4-1, 22, 0-9, 0); // 2013-4-22 Mon 00:00 JST からの経過ミリ秒数.
			var dn = Math.floor(ms / (24*60*60*1000)); // 経過日数に変換する.
			var day_of_week = dn % 7; // 曜日番号. 0:Mon, 1:Tue, ... 6:Sun.
			var subship = $ship_list[$fdeck_list[1].api_ship[1]];
			var subship_id = subship ? subship.ship_id : -1;
			$remodel_slot_today = $remodel_slotweek[day_of_week];
			if (!$remodel_slot_today) $remodel_slotweek[day_of_week] = $remodel_slot_today = {};
			// remove old recipe:subship data
			for (var id in $remodel_slot_today) {
				if ($remodel_slot_today[id] == subship_id)
					delete $remodel_slot_today[id];
			}
			// update $remodel_slotlist and $remodel_slotweek.
			var list = json.api_data;
			list.forEach(function(data) {
				var id = data.api_id; // レシピID.
				var prev = $remodel_slotlist[id];
				if (prev) {
					if (prev.my_lv10)          data.my_lv10 = prev.my_lv10;
					if (prev.my_lv6)           data.my_lv6  = prev.my_lv6;
					if (prev.api_req_slot_id)  data.api_req_slot_id  = prev.api_req_slot_id;
					if (prev.api_req_slot_num) data.api_req_slot_num = prev.api_req_slot_num;
				}
				$remodel_slotlist[id] = data;
				$remodel_slot_today[id] = subship_id;
			});
			save_storage('remodel_slotlist', $remodel_slotlist);
			save_storage('remodel_slotweek', $remodel_slotweek);
			// print remodel list on today.
			print_remodel_slotlist($remodel_slot_today);
		}
	}
	else if (api_name == '/api_req_kousyou/remodel_slotlist_detail') {
		// 装備改修選択.
		func = function(json) {
			var params = decode_postdata_params(request.request.postData.params);
			// update $remodel_slotlist
			var d = json.api_data;
			var item = $slotitem_list[params.api_slot_id];
			var data = $remodel_slotlist[params.api_id];
			if (data.api_req_remodelkit == null) return;
			if (item.level >= 10)    data.my_lv10 = d;
			else if (item.level >= 6) data.my_lv6 = d;
			else if (d.api_req_slot_num) {
				data.api_req_slot_id  = d.api_req_slot_id;
				data.api_req_slot_num = d.api_req_slot_num;
			}
			save_storage('remodel_slotlist', $remodel_slotlist);
			save_storage('remodel_slotweek', $remodel_slotweek);
			// print remodel list on today.
			print_remodel_slotlist($remodel_slot_today);
		}
	}
	else if (api_name == '/api_req_kousyou/remodel_slot') {
		// 装備改修結果.
		func = function(json) {	// 明石の改修工廠で改修した装備をリストに反映する.
			var d = json.api_data;
			add_slotitem_list(d.api_after_slot);	// 装備リストを更新する.
			slotitem_delete(d.api_use_slot_id);		// 改修で消費した装備を装備リストから抜く.
			update_material(d.api_after_material, $material.remodelslot);	/// 改修による資材消費を記録する.
			print_remodel_slotlist($remodel_slot_today);
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
	else if (api_name == '/api_req_hensei/preset_select') {
		// 編成展開.
		func = function(json) {
			var id = decode_postdata_params(request.request.postData.params).api_deck_id;	// 艦隊番号.
			var deck = json.api_data;
			$fdeck_list[id] = deck;
			update_fdeck_list($fdeck_list); // 編成結果を $ship_fdeck に反映する.
			print_port();
		};
	}
	else if (api_name == '/api_req_hensei/combined') {
		// 連合艦隊編成・解除.
		func = function(json) {
			$combined_flag = decode_postdata_params(request.request.postData.params).api_combined_type;	// 0:解除, 1:機動部隊, 2:水上部隊, 3:輸送護衛部隊.
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
	else if (api_name == '/api_req_hensei/lock') {
		// 艦娘ロック.
		func = function(json) {
			var id = decode_postdata_params(request.request.postData.params).api_ship_id;	// ロック変更した艦娘ID.
			var ship = $ship_list[id];
			if (ship) {
				ship.locked = json.api_data.api_locked;
				print_port();
			}
		};
	}
	else if (api_name == '/api_req_member/updatedeckname') {
		// 艦隊名変更.
		var params = decode_postdata_params(request.request.postData.params);
		$fdeck_list[params.api_deck_id].api_name = params.api_name;
		print_port();
	}
	else if (api_name == '/api_get_member/questlist') {
		// 任務一覧.
		let tab_id = decode_postdata_params(request.request.postData.params).api_tab_id;
		func = function(json) { // 任務総数と任務リストを記録する.
			if ($quest_count == -1) {
				// 任務一覧の初回は、前回保存した遂行状態をすべてリセットする.
				// 他のPCでクリアした任務はapi_listから消えるので遂行状態が永遠に更新できない. この不具合を避けるため.
				for (let id in $quest_list) {
					$quest_list[id].api_state = -1;
				}
			}
			let d = json.api_data;
			if (tab_id == 0) $quest_count = d.api_count; // 絞り込み無しの任務一覧の場合にのみ任務総数が得られる.
			$quest_exec_count = d.api_exec_count;
			if (d.api_list) {
				const w = get_weekly();
				for (let data of d.api_list) {
					if (data == -1) continue; // 最終ページには埋草で-1 が入っているので除外する.
					data.yps_daily = w.daily;
					data.yps_week  = w.week;
					data.yps_month = w.month;
					$quest_list[data.api_no] = data;
					if (data.api_no == 214) {
						w.quest_state = data.api_state; // あ号任務ならば、遂行状態を記録する(1:未遂行, 2:遂行中, 3:達成)
					}
				}
			}
			save_storage('quest_list', $quest_list);
			on_mission_check();
		};
		if ($debug_battle_json) {
			$battle_log = [];
			$battle_deck_id = $debug_battle_json.api_data.api_deck_id;
			func = function(json) {
				on_battle($debug_battle_json, $debug_api_name);
			}
		}
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
	else if (api_name == '/api_req_air_corps/supply') {
		// 基地航空隊の補給実施.
		func = function(json) {
			var d = json.api_data;
			var now = $material.now.concat();
			now[0] = d.api_after_fuel;		// 補給後の燃料値.
			now[3] = d.api_after_bauxite;	// 補給後のボーキサイト値.
			update_material(now, $material.charge);
			print_port();
		};
	}
	else if (api_name == '/api_req_air_corps/set_plane') {
		// 基地航空隊の配備実施.
		func = function(json) {
			var d = json.api_data;
			if (d.api_after_bauxite > 0) {
				var now = $material.now.concat();
				now[3] = d.api_after_bauxite;	// 配備後のボーキサイト値.
				update_material(now, $material.charge);
				print_port();
			}
		};
	}
	else if (api_name == '/api_req_quest/stop') {
		// 任務解除.
		var params = decode_postdata_params(request.request.postData.params);
		let quest = $quest_list[params.api_quest_id];
		if (quest) {
			quest.api_state = 1; // 未遂行に戻す. 任務リスト表示が「推敲中のみモード」の場合、直後の任務リストから消えて更新されないのでこれが必要である.
			// 直後に来る /api_get_member/questlist の処理にて、遂行中任務カウンタ更新とデータ保存と再表示が行われるので、ここではそれらの処理は不要である.
		}
	}
	else if (api_name == '/api_req_quest/clearitemget') {
		// 任務クリア.
		var params = decode_postdata_params(request.request.postData.params);
		let quest = $quest_list[params.api_quest_id];
		if (quest) {
			quest.api_state = -1; // 達成をリセットする.
			quest.yps_clear = $svDateTime; // クリア時刻を記録し、クリア済みをマークする.
			$quest_count--;		// 絞り込み任務リストの場合は, 直後の api_get_member/questlist では任務総数が得られないのでここで更新する.
			// 直後に来る /api_get_member/questlist の処理にて、遂行中任務カウンタ更新とデータ保存と再表示が行われるので、ここではそれらの処理は不要である.
		}
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
			update_material(json.api_data, $material_sum);
			$material_sum = null;
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
			$ship_escape = {};
			$combined_flag = json.api_data.api_combined_flag;	// 連合艦隊編成有無.
			update_material(json.api_data.api_material, $material.autosupply);	// 資材を更新する. 差分を自然増加として記録する.
			var basic = json.api_data.api_basic;
			$command_lv   = basic.api_level;
			$max_ship     = basic.api_max_chara;
			$max_slotitem = basic.api_max_slotitem + 3;
			if ($battle_deck_id > 0) {
				var log = map_name();
				var msg = ['YPS_mission'+$battle_deck_id];
				push_listform(msg, $battle_log);
				if (!/^演習/.test(log) && $is_next) log += '(道中撤退)';
				$last_mission[$battle_deck_id] = ['前回出撃: ' + log, msg];
				$battle_deck_id = -1;
				$do_print_port_on_slot_item = true;	// 戦闘直後の母港帰還時は、後続する slot_item で艦載機の熟練度が更新されるまで print_port() を遅延する.
			}
			else {
				print_port();
			}
		};
	}
	else if (api_name == '/api_get_member/ship_deck') {
		// 進撃. 2015-5-18メンテにて、ship2が廃止されて置き換わった.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			delta_update_ship_list(json.api_data.api_ship_data);
			delta_update_fdeck_list(json.api_data.api_deck_data);
			// print_port()　を呼ぶのをやめて、次の　print_next() にて最新の艦隊一覧を表示する.
		};
	}
	else if (api_name == '/api_get_member/ship2') {
		// 間宮、伊良湖使用 または 月間任務 [給糧艦「伊良湖」の支援] クリア時.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			delta_update_ship_list(json.api_data); // 間宮伊良湖では全艦、月間任務クリアで差分[1]のみ. スロット装備減少のみで保有艦の増減は無いので常に差分更新でOK.
			update_fdeck_list(json.api_data_deck);
			print_port();
		};
	}
	else if (api_name == '/api_get_member/ship3') {
		// ストック装備換装、艦娘改造.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			if (decode_postdata_params(request.request.postData.params).api_shipid)
				delta_update_ship_list(json.api_data.api_ship_data); // 装備解除時は差分のみ.
			else
				update_ship_list(json.api_data.api_ship_data);
			update_fdeck_list(json.api_data.api_deck_data);
			print_port();
		};
	}
	else if (api_name == '/api_req_kaisou/slot_deprive') { // 2016.6.1メンテ更新で追加された、
		// 他艦娘装備中換装.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			if (json.api_data && json.api_data.api_ship_data) {
				delta_update_ship_list([
					json.api_data.api_ship_data.api_set_ship,
					json.api_data.api_ship_data.api_unset_ship
				]);
				print_port();
			}
		};
	}
	else if (api_name == '/api_req_kaisou/slot_exchange_index') {
		// 改装:装備順番入れ替え.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			var sid = decode_postdata_params(request.request.postData.params).api_id;
			var ship = $ship_list[sid];
			if (ship) {
				ship.slot = json.api_data.api_slot;
				print_port();
			}
		};
	}
	else if (api_name == '/api_get_member/mission') {
		// 遠征メニュー.
		func = function(json) { // 遠征任務の受諾をチェックする.
			on_mission_check(4);
		};
	}
	else if (api_name == '/api_req_mission/start') {
		// 遠征開始.
		var params = decode_postdata_params(request.request.postData.params);
		update_sortie_dn(params.api_deck_id);
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
			for (var i = 0; i < d.api_get_material.length; ++i) { // i=0..3 燃料からボーキーまで.
				$material.mission[i]    += d.api_get_material[i];
				$material.autosupply[i] -= d.api_get_material[i];	// 後続の /api_port/port にて自然増加に誤算入される分を補正する.
			}
			var add_mission_item = function(flag, get_item) {
				var id = 0;
				switch (flag) {
				case 1: id = 6; break; // バケツ.
				case 2: id = 5; break; // バーナー.
				case 3: id = 7; break; // 歯車.
				case 4: id = get_item.api_useitem_id; break; // その他のアイテム.
				}
				if (id >= 1 && id <= 8 && get_item) {
					$material.mission[id-1]    += get_item.api_useitem_count;
					$material.autosupply[id-1] -= get_item.api_useitem_count;	// 後続の /api_port/port にて自然増加に誤算入される分を補正する.
				}
			};
			add_mission_item(d.api_useitem_flag[0], d.api_get_item1);
			add_mission_item(d.api_useitem_flag[1], d.api_get_item2);
			// 直後に /api_port/port パケットが来るので print_port() は不要.
		};
	}
	else if (api_name == '/api_get_member/practice') {
		// 演習メニュー.
		// 演習出撃APIの流れ:
		// practice -> 一覧から演習相手を選ぶ -> get_practice_enemyinfo -> 相手艦隊構成を見て出撃艦隊と陣形を選ぶ -> battle -> midnight_battle -> battle_result
		func = function(json) { // 演習任務の受諾をチェックする.
			on_mission_check(3);
			// 演習遂行数を数える.
			var n = json.api_data.api_list.reduce(function(count, data) { return count + (data.api_state > 0); }, 0);
			get_weekly().practice_done = n;
		};
	}
	else if (api_name == '/api_req_member/get_practice_enemyinfo') {
		// 演習相手の情報.
		func = function(json) { // 演習相手の提督名を記憶する.
			$next_enemy = "演習相手:" + json.api_data.api_nickname;
			$next_mapinfo = { api_name: "演習", yps_opt_name: get_weekly().practice_done + 1 };
		};
	}
	else if (api_name == '/api_get_member/mapinfo') {
		// 海域選択メニュー.
		func = function(json) { // 海域情報を記録する.
			$mapinfo_rank = {};
			var uncleared = [];
			json.api_data.api_map_info.forEach(function(data) {
				var evm = data.api_eventmap;
				var mst = $mst_mapinfo[data.api_id];
				mst.yps_opt_name = null;
				if (evm)
					$mapinfo_rank[data.api_id] = evm.api_selected_rank;
				if (!data.api_cleared) {
					// 2017.11: イベント海域の初回攻略時はnow_maphps,max_maphpsともに9999固定であり、正しい値ではない. 二回目以後は正しい値なのでこの問題は放置する.
					var now = evm ? evm.api_now_maphp : data.api_defeat_count;
					var max = evm ? evm.api_max_maphp : mst.api_required_defeat_count;
					mst.yps_opt_name = (evm ? (evm.api_gauge_type == 3 ? 'TP' : 'HP') : '') + fraction_percent_name(now, max);
					uncleared.push('* ' + map_name(mst));
				}
			});

			// 基地航空隊情報
			var air_base = [];
			// 基地航空隊の開放前は json.api_data.api_air_base は存在しない
			if (json.api_data.api_air_base) {
				air_base.push('YPS_air_base_mapinfo');
				json.api_data.api_air_base.forEach(function(data) {
					var planes = [];
					planes.push('YPS_air_base_' + data.api_area_id + '_' + data.api_rid);
					var charged = true;
					var plane_info = data.api_plane_info;
					var slot_seiku = 0;
					var base_intercept_bonus = 1;
					for (var i = 0; i < plane_info.length; i++) {
						var pi = plane_info[i];
						if (pi.api_state > 0) {
							var item = $slotitem_list[pi.api_slotid];
							planes.push(
								'* '
								+ get_squadron_name(pi.api_squadron_id) + ' '
								+ (pi.api_state == 2 ? '配置転換中' : get_squadron_cond_name(pi.api_cond)) + ': '
								+ slotitem_name(item.item_id, item.lv, item.alv, item.p_alv, pi.api_count, pi.api_max_count)
							);
							if (pi.api_count != pi.api_max_count) {
								charged = false;
							}
							slot_seiku += slotitem_seiku(item.item_id, item.level, item.alv, pi.api_count, data.api_action_kind);
							var plane_intercept_bonus = slotitem_intercept_bonus(item.item_id);
							if (plane_intercept_bonus > base_intercept_bonus)
								base_intercept_bonus = plane_intercept_bonus;
						} else {
							planes.push('* ' + get_squadron_name(pi.api_squadron_id) + ' 未配備:');
						}
					}
					if (data.api_action_kind == 2) slot_seiku *= base_intercept_bonus;

					air_base.push(
						get_air_base_action_name(data.api_action_kind) + " "
						+ data.api_name + (charged ? ' ' : ' 未補充')
						+ " (対象海域 " + get_maparea_name(data.api_area_id)
						+ " 戦闘行動半径" + data.api_distance
						+ " 制空値:"  + Math.floor(slot_seiku)
						+ ")"
					);
					air_base.push(planes);
				});
			}
			print_mapinfo(uncleared, air_base);
		};
	}
	else if (api_name == '/api_req_map/select_eventmap_rank') {
		// 海域難易度の初回選択／変更.
		var params = decode_postdata_params(request.request.postData.params);
		$mapinfo_rank[params.api_maparea_id * 10 + params.api_map_no] = params.api_rank;	// 1:丁, 2:丙, 3:乙, 4:甲.
		func = function(json) { // 海域HPを記録する.
			var evm = json.api_data.api_maphp;
			var mst = $mst_mapinfo[params.api_maparea_id * 10 + params.api_map_no];
			if (evm) {
				var now = evm.api_now_maphp;
				var max = evm.api_max_maphp;
				mst.yps_opt_name = (evm.api_gauge_type == 3 ? 'TP' : 'HP') + fraction_percent_name(now, max);
			}
		};
	}
	else if (api_name == '/api_req_map/start') {
		// 海域初戦陣形選択.
		// 出撃APIの流れ：
		//	mapinfo -> mapcell -> start -> 陣形選択 -> battle -> battle_result -> 進撃/撤退/帰還
		//	[進撃] ship_deck -> next -> 陣形選択 -> battle -> battle_result -> 進撃/撤退/帰還
		//	[撤退/帰還] port -> slot_item -> unsetslot -> useitem
		var params = decode_postdata_params(request.request.postData.params);
		$battle_deck_id = params.api_deck_id;
		$battle_count = 0;
		$battle_log = [];
		$is_boss = false;
		make_debug_ship_names();
		update_sortie_dn($battle_deck_id); if ($combined_flag) update_sortie_dn(2);
		func = on_next_cell;
	}
	else if (api_name == '/api_req_map/next') {
		// 海域次戦陣形選択.
		make_debug_ship_names();
		func = on_next_cell;
	}
	else if (api_name == '/api_req_sortie/battle'
		|| api_name == '/api_req_sortie/airbattle'
		|| api_name == '/api_req_sortie/ld_airbattle'
		|| api_name == '/api_req_combined_battle/battle'
		|| api_name == '/api_req_combined_battle/battle_water'
		|| api_name == '/api_req_combined_battle/airbattle'
		|| api_name == '/api_req_combined_battle/ld_airbattle'
		|| api_name == '/api_req_combined_battle/ec_battle' // 敵連合艦隊.
		|| api_name == '/api_req_combined_battle/each_battle' // 自連合艦隊(機動) vs 敵連合艦隊.
		|| api_name == '/api_req_combined_battle/each_battle_water' // 自連合艦隊(水上) vs 敵連合艦隊.
		) {
		// 昼戦開始.
		$battle_count++;
		$f_beginhps = null;
		$e_beginhps = null;
		$e_prevhps  = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_battle_midnight/battle'
		|| api_name == '/api_req_combined_battle/midnight_battle'
		|| api_name == '/api_req_combined_battle/ec_midnight_battle' // 敵連合艦隊.
		) {
		// 昼戦→夜戦追撃.
		func = on_battle;
	}
	else if (api_name == '/api_req_battle_midnight/sp_midnight'
		|| api_name == '/api_req_combined_battle/sp_midnight') {
		// 夜戦開始.
		$battle_count++;
		$f_beginhps = null;
		$e_beginhps = null;
		$e_prevhps  = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_sortie/night_to_day'
		|| api_name == '/api_req_combined_battle/ec_night_to_day') {
		// 夜戦→昼戦追撃.
		$battle_count++;
		$f_beginhps = null;
		$e_beginhps = null;
		$e_prevhps  = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_practice/battle') {
		// 演習開始.
		var params = decode_postdata_params(request.request.postData.params);
		$battle_deck_id = params.api_deck_id;
		$battle_count = 1;
		$f_beginhps = null;
		$e_beginhps = null;
		$e_prevhps  = null;
		$battle_log = [];
		make_debug_ship_names();
		update_sortie_dn($battle_deck_id);
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
			if ($battle_count == 1) { // 出撃数.
				w.sortie++;
				w.savetime = 0;
			}
			if (r == 'S') { // S勝利数.
				w.win_S++;
				w.savetime = 0;
			}
			if ($is_boss) { // ボス到達数、ボス勝利数.
				w.boss_cell++;
				if (r == 'S' || r == 'A' || r == 'B') w.win_boss++;
				w.savetime = 0;
			}
			if (w.savetime == 0) { save_weekly(); } // 更新があれば再保存する.
		};
	}
	else if (api_name == '/api_req_practice/battle_result') {
		// 演習結果.
		func = function(json) {
			on_battle_result(json);
			get_weekly().practice_done++;
			save_weekly();
		}
	}
	else if (api_name == '/api_req_combined_battle/goback_port'
		|| api_name == '/api_req_sortie/goback_port') {
		// 護衛退避.
		on_goback_port();
	}
	if (!func) return;
	request.getContent(function (content) {
		if (!content) return;
		var json = JSON.parse(content.replace(/^svdata=/, ''));
		if (!json || !json.api_data) return;
		func(json, api_name);
	});
});
