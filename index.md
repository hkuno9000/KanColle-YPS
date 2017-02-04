# 艦これ余所見プレイ支援 KanColleYPS
* v1.5.4 Feb.2017: 2017-02-04
* 開発サイト: https://github.com/hkuno9000/KanColle-YPS
* 公開サイト: http://hkuno9000.github.io/KanColle-YPS
* リリース履歴: https://github.com/hkuno9000/KanColle-YPS/releases

## 開発コンセプト
* 艦これの画面から目を離していても、ゲーム進行状況をすべて把握することが目的です。
* 遠征終了時刻や任務遂行状況を記録し、メモがわりに使えるようにします。
* 大破進撃を検出して警告します。
* 各艦毎の攻撃種別・使用装備・与ダメージを戦闘詳報として記録し、攻撃力検証に使えるようにします。
* キラ付け、近代化改修、装備改修、熟練度など、ロックした艦と装備の全内容を一覧表示します。

## インストール方法
Flash PlayerはChrome内蔵のほうを使用してください

1. ソースコード一式のZIPファイルをダウンロードし、適当なフォルダへ展開する
1. または `git clone https://github.com/hkuno9000/KanColle-YPS.git`　でフォルダへ展開する
1. Google Chromeの拡張機能設定ページを開く(右肩の三本線→設定→左列の拡張機能)
1. 【デベロッパー モード】にチェックを入れる
1. 【パッケージ化されていない拡張機能を読み込む】ボタンを押して、ソース展開したフォルダを指定する(これで拡張機能がインストールされる)

## バージョンアップ方法
1. ソース展開フォルダへZIPファイルの中身を上書き(または `git pull`)して、Chromeを再起動する.

## 使い方
1. Google Chrome起動時に「デベロッパーモードの拡張機能を無効にする」とのメッセージボックスを「キャンセル」する.
  * **「キャンセル」ではなく「無効にする」を選ぶと、このプラグインが無効化されてしまいます。**
1. Google Chromeの【デベロッパー ツール】を起動する(右肩の三本線→その他のツール→デベロッパーツール)
  * **デベロッパーツールを起動させておかないと動作しません**
  * Opt+Cmd+I(Mac), Ctrl+Shift+I, F12 キーを押しても起動します。
1. Google Chromeで艦これにログインすると、画面右側に「艦これ余所見プレイ支援」と表示されます。
1. 母港画面では、画面右側に「資材増減数、艦娘保有数、装備保有数、改造/近代化改修可能艦数、キラ付艦数、修理中、建造中、任務遂行数、艦隊１～４」の各メニューが表示されます。
1. メニューの + ボタンをクリックすると詳細が表示されます。
1. 艦隊１～４の Cond 値は49が平常で50以上がキラキラです。53以上が二重キラ、85以上が三重キラです。
1. あ号任務についてはその内訳（出撃数、ボス勝利、ボス到達、S勝利）を表示します。
1. ドラム缶装備の待機艦（遠征交代要員）をCond値別に一覧表示します。
1. 羅針盤・陣形選択画面では次戦闘マスにて過去に遭遇した敵編成の一覧を表示します。大破進撃ならば警告します。
1. 戦闘画面では、画面右側に敵味方艦隊のダメージ(撃沈、大破、中破、小破)と戦果を表示します。
1. 遠征、演習、入渠時には任務受諾状況を表示し、任務チェック漏れを警告します。
1. 遠征結果、道中資源、任務達成、入渠、工廠による資材増減を記録して表示します。週間収支(月曜5:00AM以降の増減)と今回収支(ログイン以降の増減)も表示します。
1. gooleアカウントの同期機能を利用して、週間収支とあ号任務の進捗内訳をPC間で同期します。(右肩の三本線→設定→ログイン同期の詳細設定　にてアプリと拡張機能にチェックを入れる)
1. 画面最上部の「全閉」ボタンはメニューをすべて閉じます。
1. 画面最上部の「←」「→」ボタンは表示内容を履歴参照します。

### 母港画面サンプル
![port screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-port.png)

### 戦況画面サンプル
![battle screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-battle.png)

### 戦闘詳報サンプル
![battle screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-battle-detail.png)

### 羅針盤画面の大破進撃警告サンプル
![battle screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-next-damage-alert.png)

### 帰港画面サンプル
![battle screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-ret.png)

### 資材収支表サンプル
![battle screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-supply.png)

### ロック艦一覧（cond降順)サンプル
![locked ship screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-cond-list.png)

### ロック装備一覧（改修中★とレベル数付)サンプル
![locked slotitem screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-slotitem-list.png)

### 改造、近代化改修可能艦一覧サンプル
![kaizou screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-kaizou-list.png)

### 修理中(入渠)、要修理艦一覧サンプル
![kaizou screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-repair-list.png)

### 未ロック、未保有、ダブリ艦一覧サンプル
![unlock unown double screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-unlock-unown-double.png)

### 次戦闘マス敵遭遇回数記録サンプル
![next enemy count screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-next-enemy-count.png)

### 遠征交代要員一覧サンプル
![kira standby screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-kira-standby.png)

### 演習任務チェックサンプル
![practice quest check screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-practice-quest-check.png)

### 遠征任務チェックサンプル
![practice quest check screenshot](http://hkuno9000.github.io/KanColle-YPS/images/YPS-mission-quest-check.png)

## 注意事項
* 大破進撃は自己責任でお願いします。
* 戦闘後のドロップ艦が持ってきた装備の数は、母港帰還までカウントできない場合があります。

## 仕組みなど
元々Google Chromeにあるネットワークをモニタリングする機能を使って、サーバから送られてくる各種情報を拾って、ゲーム画面の右端にテキスト表示します。
完全にパッシブ動作で、ゲームサーバへのリクエスト送信はしません。自動実行機能もありません。
仕組み上、ゲーム画面の演出進行と、こちらの表示更新のタイミングが合いません。先に結果が見えてしまいますがご容赦ください。

## 参考プロジェクト
下記を元にして自分が欲しい機能を付け足しました。

* 本家 https://github.com/kageroh/cond_checker
* 一部機能をマージ https://github.com/t-f-m/cond_checker_mod
