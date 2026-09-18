chrome.runtime.onMessage.addListener(function (req) {
	if (req && req.alarm) {
		if (req.alarm.action === 'set') {
			if (req.alarm.data) {
				var item = {};
				item['alarm_' + req.alarm.name] = req.alarm.data;
				chrome.storage.local.set(item, function () {
					chrome.alarms.create(req.alarm.name, { when: req.alarm.when });
				});
			} else {
				chrome.alarms.create(req.alarm.name, { when: req.alarm.when });
			}
		} else if (req.alarm.action === 'clear') {
			chrome.alarms.clear(req.alarm.name);
			chrome.storage.local.remove('alarm_' + req.alarm.name);
		}
		return;
	}

	chrome.tabs.query({url:[
			'https://play.games.dmm.com/game/kancolle',
			'https://play.games.dmm.com/game/kancolle/*'
		]}, function (tab) {
		if (tab && tab.length > 0 && tab[0].id) {
			chrome.tabs.sendMessage(tab[0].id, req);
		}
	});
});

chrome.alarms.onAlarm.addListener(function (alarm) {
	var key = 'alarm_' + alarm.name;
	chrome.storage.local.get(['yps_notification_enabled', key], function (res) {
		if (!res || !res.yps_notification_enabled) {
			chrome.storage.local.remove(key);
			return;
		}
		var data = res[key] || {};
		chrome.notifications.create(alarm.name + '_' + Date.now(), {
			type: 'basic',
			iconUrl: 'icons/icon128.png',
			title: data.title || 'KanColle-YPS',
			message: data.message || '時間になりました。',
			priority: 0
		});
		chrome.storage.local.remove(key);
	});
});

chrome.notifications.onClicked.addListener(function (notificationId) {
	chrome.tabs.query({
		url: [
			'https://play.games.dmm.com/game/kancolle',
			'https://play.games.dmm.com/game/kancolle/*'
		]
	}, function (tabs) {
		if (tabs && tabs.length > 0) {
			var tab = tabs[0];
			chrome.tabs.update(tab.id, { active: true });
			if (tab.windowId) {
				chrome.windows.update(tab.windowId, { focused: true });
			}
		}
	});
	chrome.notifications.clear(notificationId);
});
