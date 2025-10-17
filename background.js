chrome.runtime.onMessage.addListener(function (req) {
	chrome.tabs.query({url:[
			'https://play.games.dmm.com/game/kancolle'
		]}, function (tab) {
		chrome.tabs.sendMessage(tab[0].id, req);
	});
});
