// -*- coding: utf-8 -*-
var $ship_list		= load_storage('ship_list');
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
var $material = {};
var $quest_count = 0;
var $quest_list = {};
var $battle_count = 0;
var $ndock_list = {};
var $enemy_id = null;

//-------------------------------------------------------------------------
// Ship クラス.
function Ship(data, ship) {
	this.p_cond	= (ship) ? ship.c_cond : 49;
	this.c_cond	= data.api_cond;
	this.maxhp	= data.api_maxhp;
	this.nowhp	= data.api_nowhp;
	this.slot	= data.api_slot;
	this.lv		= data.api_lv;
	this.locked	= data.api_locked;
	this.ndock_time	= data.api_ndock_time;
	this.ship_id	= data.api_ship_id;
}

Ship.prototype.name_lv = function() {
	return ship_name(this.ship_id) + 'Lv' + this.lv;
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
				if (id != -1 && !$slotitem_list[id]) $slotitem_list[id] = { item_id: -1, locked: 0 };
			});
		}
	});
	save_storage('ship_list', $ship_list);
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

function diff_name(now, prev) {
	var diff = now - prev;
	if (!prev) return '';
	else if (diff > 0) return '(+' + diff + ')'; // with plus sign
	else if (diff < 0) return '(' + diff +')';   // with minus sign
	else /* diff == 0 */ return '';
}

function item_name(id) {
	switch (id) {
		case 1: return '燃料';
		case 2: return '弾薬';
		case 3: return '鋼材';
		case 4: return 'ボーキ';
		case 5: return '建造材';
		case 6: return '修復材';
		case 7: return '開発資材';
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

function slotitem_name(id) {
	var item = $mst_slotitem[id];
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
		$slotitem_list[data.api_id] = { item_id: data.api_slotitem_id, locked: data.api_locked };
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

function slotitem_names(slot) {
	if (!slot) return '';
	var a = [];
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value) {
			a.push(slotitem_name(value.item_id));
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

function hp_status(nowhp, maxhp) {
	if (nowhp < 0) nowhp = 0;
	var r = nowhp / maxhp;
	var msg = (r == 0) ? '撃沈---'
		: (r <= 0.25) ? '大破!!!'
		: (r <= 0.50) ? '中破'
		: (r <= 0.75) ? '小破'
		: (r <= 0.85) ? '..'	// 軽微2.
		: (r <  1.00) ? '.'		// 軽微1.
		: '*';					// 無傷.
	return nowhp + '/' + maxhp + ':' + msg;
}

//------------------------------------------------------------------------
// イベントハンドラ.
//
function on_port(json) {
		var req = [];
		var unlock_names = [];
		var lockeditem_list = {};
		var $unlock_ship = 0;
		var $unlock_slotitem = 0;
		//
		// ロック装備を種類毎に集計する.
		for (var id in $slotitem_list) {
			var value = $slotitem_list[id];
			if (value && value.locked) {
				if (!lockeditem_list[value.item_id])
					lockeditem_list[value.item_id] = {count:0, ship_names:[]};
				lockeditem_list[value.item_id].count++;
			}
		}
		//
		// 未ロック艦とロック装備持ち艦を検出する.
		for (var id in $ship_list) {
			var ship = $ship_list[id];
			var name = ship.name_lv();
			if (!ship.locked) {
				$unlock_ship++;
				var n = count_unless(ship.slot, -1); // スロット装備数.
				$unlock_slotitem += n;
				unlock_names.push(name + (n ? "*" : "")); // 装備持ちなら、名前の末尾に"*"を付ける.
			}
			if (ship.slot) {
				ship.slot.forEach(function(id) {
					var value = $slotitem_list[id];
					if (value && value.locked)
						lockeditem_list[value.item_id].ship_names.push(name);
				});
			}
		}
		unlock_names.reverse();	// 最新の艦を先頭にする.
		//
		// 艦娘と装備の数を表示する.
		var basic = json.api_data.api_basic;
		if (basic) {
			$max_ship     = basic.api_max_chara;
			$max_slotitem = basic.api_max_slotitem + 3;
			$combined_flag = basic.api_combined_flag;
		}
		req.push('艦娘保有数:' + Object.keys($ship_list).length + '/' + $max_ship + '(未ロック艦:' + $unlock_ship + ')');
		req.push('装備保有数:' + Object.keys($slotitem_list).length + '/' + $max_slotitem + '(未ロック艦装備:' + $unlock_slotitem + ')');
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
		// 未ロック艦一覧.
		if (unlock_names.length > 0) {
			req.push('## 未ロック艦一覧');
			req.push(['unlock_names', unlock_names.join(', ')]);
		}
		// ロック装備一覧.
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
			msg = ['lockeditem_list'];
			msg.push('\t==装備名\t==個数\t==使用艦名'); // 表ヘッダ.
			lockeditem_ids.forEach(function(id) {
				var item = lockeditem_list[id];
				msg.push('\t' + slotitem_name(id) + '\t' + item.ship_names.length + '/' + item.count + '\t|' + item.ship_names.join(', ')); 
			});
			req.push('## ロック装備一覧');
			req.push(msg);
		}
		//
		// 遂行中任務を一覧表示する.
		if (Object.keys($quest_list).length > 0) {
			msg = ['quest_list'];
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
				req.push('## 任務');
				req.push(msg);
			}
		}
		if (Object.keys($quest_list).length != $quest_count) req.push('### 任務リストを先頭から最終ページまでめくってください');
		//
		// 各艦隊の情報を一覧表示する.
		for (var f_id in $fdeck_list) {
			msg = ['fdeck_list' + f_id];
			msg.push('\t==cond\t==艦名Lv\t==hp\t==修理\t==装備'); // 表ヘッダ. 慣れれば不用な気がする.
			var deck = $fdeck_list[f_id];
			req.push(($combined_flag ? '## 連合艦隊' : '## 艦隊') + f_id + ': ' + deck.api_name);
			var lv_sum = 0;
			var drumcan = {ships:0, sum:0, msg:''};
			for (var i = 0, ship, s_id; ship = $ship_list[s_id = deck.api_ship[i]]; ++i) {
				lv_sum += ship.lv;
				var name = ship.name_lv();
				var cond = ship.c_cond;
				var kira_str = (cond >= 85) ? '*** ' : // 三重キラ.
				               (cond >= 53) ? '** ' : // 回避向上キラ.
				               (cond >  49) ? '* ' : // キラ.
				               (cond == 49) ? '. ' : // normal
				               /* cond < 49 */ '> '; // recovering
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
				msg.push('\t' + (i + 1) + kira_str + cond + diff_name(cond, ship.p_cond)
					+ '\t' + name
					+ '\t' + hp_str
					+ '\t' + rp_str
					+ '\t' + slotitem_names(ship.slot)
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
			msg.push('\t合計:\tLv' + lv_sum + '\t\t\t' + drumcan.msg);
			req.push(msg);
			var mission_end = deck.api_mission[2];
			if (mission_end > 0) {
				var d = new Date(mission_end);
				var id = deck.api_mission[1];
				req.push('遠征' + id + ' ' + $mst_mission[id].api_name + ': ' + d.toLocaleString());
			}
			else if (deck.api_id == $battle_deck_id) {
				req.push('出撃中');
			}
			else if ($combined_flag && $battle_deck_id == 1 && deck.api_id == 2) {
				req.push('出撃中');
			}
			else {
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
		var msg = e.api_enemy_id.toString(10);
		var fleet = load_enemy_fleet(msg);
		if (d.api_event_id == 5) {
			msg += '(boss)';
			$is_boss = true;
		}
		$next_enemy = area + ': ' + msg;
		msg += fleet ? ('\n' + fleet) : ' first encounter'; // $next_enemy には引き継がない
		chrome.extension.sendRequest('## next enemy\n' + area + ': ' + msg);
	}
	if (g) {
		var msg = item_name(g.api_id) + 'x' + g.api_getcount;
		chrome.extension.sendRequest('## next item\n' + area + ': ' + msg);
	}
}

function on_battle_result(json) {
	var d = json.api_data;
	var e = json.api_data.api_enemy_info;
	var g = json.api_data.api_get_ship;
	var msg = d.api_win_rank + ':';
	var mvp = d.api_mvp;
	if (e) {
		msg += e.api_deck_name;
		if (d.api_ship_id) {
			var total = count_unless(d.api_ship_id, -1);
			msg += '(' + d.api_dests + '/' + total + ')';
		}
	}
	if (mvp) {
		var id = $fdeck_list[$battle_deck_id].api_ship[mvp-1];
		var ship = $ship_list[id];
		msg += '\nMVP: ' + ship.name_lv();
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

function push_fdeck_status(req, fdeck, maxhps, nowhps) {
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
		req.push('\t' + i + '(' + name + ').\t' + hp_status(nowhps[i], maxhps[i]));
	}
}

function on_battle(json) {
	var d = json.api_data;
	if (!d.api_maxhps || !d.api_nowhps) return;
	var maxhps = d.api_maxhps;				// 出撃艦隊[1..6] 敵艦隊[7..12]
	var nowhps = d.api_nowhps;				// 出撃艦隊[1..6] 敵艦隊[7..12]
	var maxhps_c = d.api_maxhps_combined;	// 連合第二艦隊[1..6].
	var nowhps_c = d.api_nowhps_combined;	// 連合第二艦隊[1..6].
	var airplane = {
		seiku : null, 				// 制空権.
		touch : d.api_touch_plane,	// 触接. 夜戦はd.にある、昼戦はd.api_kouku.state1.にある.
		f_lostcount : 0				// 非撃墜数.
	};
	calc_kouku_damage(airplane, nowhps, d.api_kouku, nowhps_c); // 航空戦.
	calc_kouku_damage(airplane, nowhps, d.api_kouku2, nowhps_c); // 航空戦第二波.
	calc_damage(nowhps, d.api_opening_atack, nowhps_c);	// 開幕雷撃.
	calc_damage(nowhps, d.api_hougeki, nowhps_c);	// midnight
	calc_damage(nowhps, d.api_hougeki1, nowhps_c);
	calc_damage(nowhps, d.api_hougeki2);
	calc_damage(nowhps, d.api_hougeki3);
	calc_damage(nowhps, d.api_raigeki, nowhps_c);
	if (d.api_support_flag == 1) calc_damage(nowhps, d.api_support_info.api_support_airattack.api_stage3); // 1:航空支援.
	if (d.api_support_flag == 2) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 2:支援射撃
	if (d.api_support_flag == 3) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 3:支援長距離雷撃.
	if (!d.api_deck_id) d.api_deck_id = d.api_dock_id; // battleのデータは、綴りミスがあるので補正する.
	var fdeck = $fdeck_list[d.api_deck_id];
	$battle_deck_id = fdeck.api_id;
	if (d.api_formation) {
		$next_enemy += '\n'
			+ formation_name(d.api_formation[0]) + '/'
			+ match_name(d.api_formation[2]) + '/'
			+ formation_name(d.api_formation[1]);
		if (d.api_support_flag) $next_enemy += '+' + support_name(d.api_support_flag);
	}
	var req = [];
	req.push('# ' + ($next_mapinfo ? $next_mapinfo.api_name : '') + ' battle' + $battle_count);
	req.push($next_enemy);
	if (d.api_search) {
		req.push('索敵: ' + search_name(d.api_search[0])); // d.api_search[1] は敵索敵か??
	}
	if (airplane.touch) {
		var t0 = airplane.touch[0]; if (t0 != -1) req.push('触接中: ' + slotitem_name(t0));
		var t1 = airplane.touch[1]; if (t1 != -1) req.push('被触接中: ' + slotitem_name(t1));
	}
	if (airplane.seiku != null) req.push(seiku_name(airplane.seiku));
	req.push('## friend damage');
	push_fdeck_status(req, fdeck, maxhps, nowhps);
	req.push('被撃墜数: ' + airplane.f_lostcount);
	if (nowhps_c) {
		req.push('## friend(2nd) damage');
		push_fdeck_status(req, $fdeck_list[2], maxhps_c, nowhps_c); // 連合第二艦隊は二番固定です.
	}
	req.push('## enemy damage');
	var enemy_fleet = '';
	for (var i = 1; i <= 6; ++i) {
		var ke = d.api_ship_ke[i];
		if (ke == -1) continue;
		var name = ship_name(ke) + 'Lv' + d.api_ship_lv[i];
		req.push('\t' + i + '(' + name + ').\t' + hp_status(nowhps[i+6], maxhps[i+6]));
		enemy_fleet += '\t' + i + '(' + name + ')';
	}
	if($enemy_id) { // 演習は$enemy_idが空
		save_enemy_fleet(enemy_fleet);
	}
	chrome.extension.sendRequest(req);
}

function load_enemy_fleet(e_id){
	$enemy_id = e_id;
	var e = load_storage('enemy');
	return e[e_id];
}

function save_enemy_fleet(enemy_fleet){
	var e = load_storage('enemy');
	e[$enemy_id] = enemy_fleet;
	save_storage('enemy', e);
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
		func = function(json) { //　艦種表を取り込む.
			update_mst_ship(json.api_data.api_mst_ship);
			update_mst_slotitem(json.api_data.api_mst_slotitem);
			update_mst_mission(json.api_data.api_mst_mission);
			update_mst_mapinfo(json.api_data.api_mst_mapinfo);
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
		var deck = $fdeck_list[params.api_id];
		var id  = parseInt(params.api_ship_id, 10);		// -2:一括解除, -1:解除, 他:艦娘ID.
		var idx = parseInt(params.api_ship_idx, 10);	// -1:一括解除, 0..N:変更位置.
		if (id == -2) {
			// 旗艦以外の艦を外す(-1を設定する).
			for (var i = 1; i < deck.api_ship.length; ++i) deck.api_ship[i] = -1;
		}
		else if (id == -1) {
			// 外す.
			deck.api_ship.splice(idx, 1);
			deck.api_ship.push(-1);
		}
		else { // id = 0..N
			// 追加または交換.
			var old_idx = -1;
			for (var i = 0; i < deck.api_ship.length; ++i) {
				if (deck.api_ship[i] == id) {
					old_idx = i;
					break;
				}
			}
			if (old_idx == -1) { // 追加.
				deck.api_ship[idx] = id;
			}
			else { // 交換.
				var id2 = deck.api_ship[idx];
				deck.api_ship[idx]     = id;
				deck.api_ship[old_idx] = id2; // 交換.
				if (id2 == -1) {
					deck.api_ship.splice(old_idx, 1); // 外して前詰めする.
					deck.api_ship.push(-1);
				}
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
			if (json.api_data.api_disp_page == 1 && $quest_count != Object.keys($quest_list).length) {
				$quest_list = {}; // 任務総数が変わったらリストをクリアする.
			}
			list.forEach(function(data) {
				if (data == -1) return; // 最終ページには埋草で-1　が入っているので除外する.
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
		|| api_name == '/api_req_combined_battle/airbattle') {
		// 昼戦開始.
		$battle_count++;
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
		func = on_battle;
	}
	else if (api_name == '/api_req_sortie/night_to_day') {
		// 夜戦→昼戦追撃.
		func = on_battle;
	}
	else if (api_name == '/api_req_practice/battle') {
		// 演習開始.
		$battle_count = 1;
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
