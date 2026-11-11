// label translations: one row per English label, columns in the order of `cols`
const RAW = `
Home|首页|Главная|होम|ホーム|홈|Accueil|Inicio|Start|Início
Live|实时|Матч|लाइव|ライブ|라이브|En direct|En vivo|Live|Ao vivo
Career|生涯|Карьера|करियर|キャリア|커리어|Carrière|Carrera|Karriere|Carreira
Squad|小队|Отряд|स्क्वाड|スクワッド|스쿼드|Escouade|Escuadra|Squad|Esquadrão
Arsenal|军械库|Арсенал|शस्त्रागार|アーセナル|무기고|Arsenal|Arsenal|Arsenal|Arsenal
Playbook|战术本|Тактики|प्लेबुक|プレイブック|전술집|Tactiques|Tácticas|Taktikbuch|Táticas
Live Match|实时对局|Текущий матч|लाइव मैच|ライブマッチ|실시간 매치|Match en direct|Partida en vivo|Live-Match|Partida ao vivo
Progression|进度|Прогресс|प्रगति|進行状況|진행도|Progression|Progreso|Fortschritt|Progresso
Matches|对局|Матчи|मैच|マッチ|매치|Matchs|Partidas|Matches|Partidas
Encounters|遭遇记录|Встречи|मुलाकातें|遭遇|만난 플레이어|Rencontres|Encuentros|Begegnungen|Encontros
Leaderboard|排行榜|Таблица лидеров|लीडरबोर्ड|ランキング|순위표|Classement|Clasificación|Bestenliste|Classificação
Friends|好友|Друзья|दोस्त|フレンド|친구|Amis|Amigos|Freunde|Amigos
Feed|动态|Лента|फ़ीड|フィード|피드|Fil|Actividad|Feed|Feed
Notes|笔记|Заметки|नोट्स|ノート|노트|Notes|Notas|Notizen|Notas
Lookup|查询|Поиск игрока|खोज|プレイヤー検索|조회|Recherche|Búsqueda|Suche|Consulta
Loadout|配装|Снаряжение|लोडआउट|ロードアウト|로드아웃|Équipement|Equipamiento|Ausrüstung|Equipamento
Store|商店|Магазин|स्टोर|ストア|상점|Boutique|Tienda|Shop|Loja
Weapons|武器|Оружие|हथियार|武器|무기|Armes|Armas|Waffen|Armas
Strategies|战术|Стратегии|रणनीतियाँ|戦略|전략|Stratégies|Estrategias|Strategien|Estratégias
What's new|更新内容|Что нового|नया क्या है|新着情報|새 소식|Nouveautés|Novedades|Neuigkeiten|Novidades
Feedback|反馈|Отзыв|फ़ीडबैक|フィードバック|피드백|Avis|Comentarios|Feedback|Feedback
Settings|设置|Настройки|सेटिंग्स|設定|설정|Paramètres|Ajustes|Einstellungen|Configurações
Search|搜索|Поиск|खोजें|検索|검색|Rechercher|Buscar|Suchen|Buscar
You|你|Вы|आप|あなた|나|Vous|Tú|Du|Você
Cancel|取消|Отмена|रद्द करें|キャンセル|취소|Annuler|Cancelar|Abbrechen|Cancelar
Add|添加|Добавить|जोड़ें|追加|추가|Ajouter|Añadir|Hinzufügen|Adicionar
Owned|已拥有|Есть|आपके पास है|所持|보유|Possédé|En propiedad|Im Besitz|Adquirido
Apply|应用|Применить|लागू करें|適用|적용|Appliquer|Aplicar|Anwenden|Aplicar
Buddy|挂饰|Брелок|बडी|ガンバディー|총기 장식|Porte-bonheur|Colgante|Anhänger|Chaveiro
Clear|清除|Очистить|साफ़ करें|クリア|지우기|Effacer|Borrar|Leeren|Limpar
Close|关闭|Закрыть|बंद करें|閉じる|닫기|Fermer|Cerrar|Schließen|Fechar
Hidden|已隐藏|Скрыто|छिपा हुआ|非表示|숨김|Masqué|Oculto|Verborgen|Oculto
Message|消息|Сообщение|संदेश|メッセージ|메시지|Message|Mensaje|Nachricht|Mensagem
Name hidden by streamer mode|主播模式已隐藏名称|Имя скрыто режимом стримера|स्ट्रीमर मोड ने नाम छिपाया है|配信者モードで名前は非表示|스트리머 모드로 이름 숨김|Nom masqué par le mode streamer|Nombre oculto por el modo streamer|Name durch Streamer-Modus verborgen|Nome oculto pelo modo streamer
Hidden by streamer mode|主播模式已隐藏|Скрыто режимом стримера|स्ट्रीमर मोड से छिपा|配信者モードで非表示|스트리머 모드로 숨김|Masqué par le mode streamer|Oculto por el modo streamer|Durch Streamer-Modus verborgen|Oculto pelo modo streamer
Open|打开|Открыть|खोलें|開く|열기|Ouvrir|Abrir|Öffnen|Abrir
Peak|最高|Пик|सर्वोच्च|最高|최고|Record|Máximo|Höchstrang|Pico
Recent matches|最近对局|Недавние матчи|हाल के मैच|最近のマッチ|최근 매치|Matchs récents|Partidas recientes|Letzte Matches|Partidas recentes
Refresh|刷新|Обновить|रीफ़्रेश|更新|새로고침|Actualiser|Actualizar|Aktualisieren|Atualizar
About|关于|О программе|जानकारी|情報|정보|À propos|Acerca de|Über|Sobre
All|全部|Все|सभी|すべて|전체|Tout|Todo|Alle|Tudo
Apply preset|应用预设|Применить пресет|प्रीसेट लागू करें|プリセットを適用|프리셋 적용|Appliquer le préréglage|Aplicar ajuste|Preset anwenden|Aplicar predefinição
Battle pass|战斗通行证|Боевой пропуск|बैटल पास|バトルパス|배틀패스|Passe de combat|Pase de batalla|Battle Pass|Passe de batalha
General|常规|Общие|सामान्य|一般|일반|Général|General|Allgemein|Geral
Match|对局|Матч|मैच|マッチ|매치|Match|Partida|Match|Partida
Opponents|对手|Противники|विरोधी|対戦相手|상대 팀|Adversaires|Rivales|Gegner|Adversários
Players|玩家|Игроки|खिलाड़ी|プレイヤー|플레이어|Joueurs|Jugadores|Spieler|Jogadores
Profile|个人资料|Профиль|प्रोफ़ाइल|プロフィール|프로필|Profil|Perfil|Profil|Perfil
Sprays|喷漆|Граффити|स्प्रे|スプレー|스프레이|Sprays|Grafitis|Sprays|Sprays
Variants|变体|Варианты|वेरिएंट|バリエーション|변형|Variantes|Variantes|Varianten|Variantes
Win rate|胜率|Процент побед|जीत दर|勝率|승률|Taux de victoire|Victorias %|Siegquote|Taxa de vitória
Your team|我方队伍|Ваша команда|आपकी टीम|味方チーム|우리 팀|Votre équipe|Tu equipo|Dein Team|Seu time
Act history|赛季记录|История актов|एक्ट इतिहास|アクト履歴|액트 기록|Historique des actes|Historial de actos|Akt-Verlauf|Histórico de atos
Act peak|赛季最高|Пик акта|एक्ट का सर्वोच्च|アクト最高|액트 최고|Record de l'acte|Máximo del acto|Akt-Höchstrang|Pico do ato
Add a friend|添加好友|Добавить друга|दोस्त जोड़ें|フレンドを追加|친구 추가|Ajouter un ami|Añadir amigo|Freund hinzufügen|Adicionar amigo
Agent contracts|特工合约|Контракты агентов|एजेंट कॉन्ट्रैक्ट|エージェント契約|요원 계약|Contrats d'agents|Contratos de agentes|Agentenverträge|Contratos de agentes
All-time peak|历史最高|Лучший ранг|अब तक का सर्वोच्च|歴代最高|역대 최고|Record absolu|Máximo histórico|Bester Rang|Pico histórico
Apply changes|应用更改|Применить изменения|बदलाव लागू करें|変更を適用|변경 적용|Appliquer les modifications|Aplicar cambios|Änderungen anwenden|Aplicar alterações
Change skins|更换皮肤|Сменить скины|स्किन बदलें|スキンを変更|스킨 변경|Changer de skins|Cambiar skins|Skins wechseln|Trocar skins
Check for updates|检查更新|Проверить обновления|अपडेट जाँचें|アップデートを確認|업데이트 확인|Rechercher des mises à jour|Buscar actualizaciones|Nach Updates suchen|Procurar atualizações
Competitive trend|竞技趋势|Тренд рейтинга|रैंक्ड रुझान|コンペティティブ推移|경쟁전 추세|Tendance classée|Tendencia competitiva|Ranglisten-Trend|Tendência competitiva
Connection|连接|Подключение|कनेक्शन|接続|연결|Connexion|Conexión|Verbindung|Conexão
Copy|复制|Копировать|कॉपी करें|コピー|복사|Copier|Copiar|Kopieren|Copiar
Copy Riot ID|复制 Riot ID|Копировать Riot ID|Riot ID कॉपी करें|Riot IDをコピー|Riot ID 복사|Copier le Riot ID|Copiar Riot ID|Riot-ID kopieren|Copiar Riot ID
Current rank|当前段位|Текущий ранг|मौजूदा रैंक|現在のランク|현재 랭크|Rang actuel|Rango actual|Aktueller Rang|Rank atual
Daily offers|每日商品|Ежедневные предложения|दैनिक ऑफ़र|デイリーオファー|일일 상점|Offres du jour|Ofertas diarias|Tagesangebote|Ofertas diárias
Data|数据|Данные|डेटा|データ|데이터|Données|Datos|Daten|Dados
Delete|删除|Удалить|हटाएँ|削除|삭제|Supprimer|Eliminar|Löschen|Excluir
Discard|放弃|Отменить|छोड़ें|破棄|버리기|Abandonner|Descartar|Verwerfen|Descartar
Equip|装备|Экипировать|लगाएँ|装備|장착|Équiper|Equipar|Ausrüsten|Equipar
Equipped|已装备|Экипировано|लगा हुआ|装備中|장착됨|Équipé|Equipado|Ausgerüstet|Equipado
Everyone|所有人|Все|सभी|全員|모두|Tout le monde|Todos|Alle|Todos
Featured bundle|精选套装|Избранный набор|फ़ीचर्ड बंडल|注目のバンドル|추천 묶음 상품|Pack à la une|Lote destacado|Angebotspaket|Pacote em destaque
Installed|已安装|Установлено|इंस्टॉल है|インストール済み|설치됨|Installé|Instalado|Installiert|Instalado
Invite|邀请|Пригласить|आमंत्रित करें|招待|초대|Inviter|Invitar|Einladen|Convidar
Latest|最新|Последняя|नवीनतम|最新|최신|Dernière|Última|Neueste|Mais recente
Levels|等级|Уровни|स्तर|レベル|레벨|Niveaux|Niveles|Stufen|Níveis
Load more|加载更多|Загрузить ещё|और लोड करें|さらに読み込む|더 보기|Charger plus|Cargar más|Mehr laden|Carregar mais
Local time|本地时间|Местное время|स्थानीय समय|現地時間|현지 시간|Heure locale|Hora local|Ortszeit|Hora local
Motion|动效|Анимация|मोशन|モーション|모션|Animations|Movimiento|Bewegung|Movimento
New|新|Новое|नया|新規|새로 만들기|Nouveau|Nuevo|Neu|Novo
No daily offers|没有每日商品|Нет ежедневных предложений|कोई दैनिक ऑफ़र नहीं|デイリーオファーなし|일일 상점 없음|Aucune offre du jour|Sin ofertas diarias|Keine Tagesangebote|Sem ofertas diárias
No ranked games yet|还没有排位对局|Рейтинговых игр пока нет|अभी कोई रैंक्ड गेम नहीं|ランク戦はまだありません|아직 경쟁전 기록 없음|Aucune partie classée|Aún no hay partidas competitivas|Noch keine Ranglistenspiele|Ainda sem partidas ranqueadas
Not enough ranked games|排位对局不足|Недостаточно рейтинговых игр|पर्याप्त रैंक्ड गेम नहीं|ランク戦が足りません|경쟁전 기록 부족|Pas assez de parties classées|Faltan partidas competitivas|Zu wenige Ranglistenspiele|Partidas ranqueadas insuficientes
Note|备注|Заметка|नोट|メモ|메모|Note|Nota|Notiz|Nota
Overlay|悬浮窗|Оверлей|ओवरले|オーバーレイ|오버레이|Overlay|Superposición|Overlay|Sobreposição
Pending|待处理|Ожидает|लंबित|保留中|대기 중|En attente|Pendiente|Ausstehend|Pendente
Presets|预设|Пресеты|प्रीसेट|プリセット|프리셋|Préréglages|Ajustes guardados|Presets|Predefinições
Rating|评分|Оценка|रेटिंग|評価|평가|Évaluation|Valoración|Bewertung|Avaliação
Recent form|近期状态|Недавняя форма|हालिया फ़ॉर्म|最近の調子|최근 성적|Forme récente|Forma reciente|Aktuelle Form|Forma recente
Reconnect|重新连接|Переподключиться|फिर से कनेक्ट करें|再接続|다시 연결|Reconnecter|Reconectar|Neu verbinden|Reconectar
Requests|请求|Заявки|अनुरोध|リクエスト|요청|Demandes|Solicitudes|Anfragen|Pedidos
Save note|保存备注|Сохранить заметку|नोट सेव करें|メモを保存|메모 저장|Enregistrer la note|Guardar nota|Notiz speichern|Salvar nota
Scan now|立即扫描|Сканировать|अभी स्कैन करें|今すぐスキャン|지금 스캔|Analyser|Escanear ahora|Jetzt scannen|Verificar agora
Seen most often|最常遇到|Чаще всего|सबसे ज़्यादा मिले|最もよく会う|가장 자주 만남|Les plus croisés|Más vistos|Am häufigsten gesehen|Mais vistos
Sent|已发送|Отправлено|भेजा गया|送信済み|보냄|Envoyé|Enviado|Gesendet|Enviado
Skin Changer|皮肤更换|Смена скинов|स्किन चेंजर|スキン変更|스킨 변경|Changeur de skins|Cambiar skins|Skin-Wechsler|Trocador de skins
Standard|标准|Стандарт|मानक|スタンダード|기본|Standard|Estándar|Standard|Padrão
Start page|起始页|Стартовая страница|शुरुआती पेज|スタートページ|시작 페이지|Page d'accueil|Página inicial|Startseite|Página inicial
Start tracking|开始追踪|Начать отслеживание|ट्रैकिंग शुरू करें|追跡を開始|추적 시작|Démarrer le suivi|Empezar seguimiento|Tracking starten|Iniciar rastreio
Tags|标签|Теги|टैग|タグ|태그|Tags|Etiquetas|Tags|Tags
Theme|主题|Тема|थीम|テーマ|테마|Thème|Tema|Design|Tema
Tier|等级|Тир|टियर|ティア|등급|Palier|Nivel|Stufe|Nível
Toggle overlay|切换悬浮窗|Показать/скрыть оверлей|ओवरले टॉगल करें|オーバーレイ切替|오버레이 전환|Afficher/masquer l'overlay|Alternar superposición|Overlay umschalten|Alternar sobreposição
Unranked|未定级|Без ранга|अनरैंक्ड|ランクなし|언랭크|Non classé|Sin rango|Ohne Rang|Sem rank
Uses Spectre|使用 Spectre|Использует Spectre|Spectre उपयोगकर्ता|Spectre利用者|Spectre 사용자|Utilise Spectre|Usa Spectre|Nutzt Spectre|Usa o Spectre
Waiting for a match|等待对局|Ожидание матча|मैच का इंतज़ार|マッチ待機中|매치 대기 중|En attente d'un match|Esperando partida|Warte auf ein Match|Aguardando partida
Wallet|钱包|Кошелёк|वॉलेट|ウォレット|지갑|Portefeuille|Cartera|Guthaben|Carteira
Wins|胜场|Победы|जीत|勝利|승|Victoires|Victorias|Siege|Vitórias
Losses|负场|Поражения|हार|敗北|패|Défaites|Derrotas|Niederlagen|Derrotas
Wishlist|愿望单|Список желаний|विशलिस्ट|ウィッシュリスト|위시리스트|Liste de souhaits|Lista de deseos|Wunschliste|Lista de desejos
Your note|你的备注|Ваша заметка|आपका नोट|あなたのメモ|내 메모|Votre note|Tu nota|Deine Notiz|Sua nota
Your party|你的小队|Ваша группа|आपकी पार्टी|あなたのパーティー|내 파티|Votre groupe|Tu grupo|Deine Gruppe|Seu grupo
Accept|接受|Принять|स्वीकार करें|承認|수락|Accepter|Aceptar|Annehmen|Aceitar
Decline|拒绝|Отклонить|अस्वीकार करें|拒否|거절|Refuser|Rechazar|Ablehnen|Recusar
Accessories|配件|Аксессуары|एक्सेसरीज़|アクセサリー|장식|Accessoires|Accesorios|Zubehör|Acessórios
Account|账号|Аккаунт|खाता|アカウント|계정|Compte|Cuenta|Konto|Conta
Account level|账号等级|Уровень аккаунта|खाता स्तर|アカウントレベル|계정 레벨|Niveau du compte|Nivel de cuenta|Kontostufe|Nível da conta
Add note|添加备注|Добавить заметку|नोट जोड़ें|メモを追加|메모 추가|Ajouter une note|Añadir nota|Notiz hinzufügen|Adicionar nota
Added|已添加|Добавлен|जोड़ा गया|追加|추가됨|Ajouté|Añadido|Hinzugefügt|Adicionado
Removed|已移除|Удалён|हटाया गया|削除|삭제됨|Retiré|Eliminado|Entfernt|Removido
All tiers|所有等级|Все тиры|सभी टियर|全ティア|모든 등급|Tous les paliers|Todos los niveles|Alle Stufen|Todos os níveis
Appearance|外观|Внешний вид|रूप-रंग|外観|모양|Apparence|Apariencia|Darstellung|Aparência
Language|语言|Язык|भाषा|言語|언어|Langue|Idioma|Sprache|Idioma
Display language|显示语言|Язык интерфейса|डिस्प्ले भाषा|表示言語|표시 언어|Langue d'affichage|Idioma de la interfaz|Anzeigesprache|Idioma de exibição
Avg|平均|Сред.|औसत|平均|평균|Moy.|Media|Schnitt|Média
Bad|差|Плохо|खराब|悪い|나쁨|Mauvais|Malo|Schlecht|Ruim
Good|好|Хорошо|अच्छा|良い|좋음|Bon|Bueno|Gut|Bom
Neutral|中立|Нейтрально|सामान्य|普通|보통|Neutre|Neutral|Neutral|Neutro
Cached data|缓存数据|Кэш|कैश डेटा|キャッシュデータ|캐시 데이터|Données en cache|Datos en caché|Zwischengespeicherte Daten|Dados em cache
Clear cache|清除缓存|Очистить кэш|कैश साफ़ करें|キャッシュをクリア|캐시 지우기|Vider le cache|Borrar caché|Cache leeren|Limpar cache
Clear feed|清空动态|Очистить ленту|फ़ीड साफ़ करें|フィードをクリア|피드 지우기|Vider le fil|Borrar actividad|Feed leeren|Limpar feed
Click-through|点击穿透|Сквозные клики|क्लिक-थ्रू|クリック透過|클릭 통과|Clics traversants|Clics a través|Klicks durchlassen|Cliques atravessam
Client version|客户端版本|Версия клиента|क्लाइंट वर्ज़न|クライアントバージョン|클라이언트 버전|Version du client|Versión del cliente|Client-Version|Versão do cliente
Close chat|关闭聊天|Закрыть чат|चैट बंद करें|チャットを閉じる|채팅 닫기|Fermer le chat|Cerrar chat|Chat schließen|Fechar chat
Close to tray|关闭到托盘|Закрывать в трей|ट्रे में बंद करें|トレイに閉じる|트레이로 닫기|Fermer dans la zone de notification|Cerrar a la bandeja|In den Infobereich schließen|Fechar para a bandeja
Minimize to tray|最小化到托盘|Сворачивать в трей|ट्रे में मिनिमाइज़ करें|トレイに最小化|트레이로 최소화|Réduire dans la zone de notification|Minimizar a la bandeja|In den Infobereich minimieren|Minimizar para a bandeja
Launch at login|开机启动|Запуск при входе|लॉगिन पर शुरू करें|ログイン時に起動|로그인 시 실행|Lancer à la connexion|Abrir al iniciar sesión|Bei Anmeldung starten|Abrir ao iniciar sessão
Wishlist alerts|愿望单提醒|Уведомления списка желаний|विशलिस्ट अलर्ट|ウィッシュリスト通知|위시리스트 알림|Alertes de la liste de souhaits|Alertas de lista de deseos|Wunschlisten-Hinweise|Alertas da lista de desejos
Reduce motion|减少动效|Меньше анимации|मोशन कम करें|モーションを減らす|모션 줄이기|Réduire les animations|Reducir movimiento|Bewegung reduzieren|Reduzir movimento
Color|颜色|Цвет|रंग|色|색상|Couleur|Color|Farbe|Cor
Competitive|竞技模式|Рейтинговая|कॉम्पिटिटिव|コンペティティブ|경쟁전|Compétition|Competitivo|Gewertet|Competitivo
Unrated|普通模式|Обычная|अनरेटेड|アンレート|일반전|Non classé|No competitivo|Ungewertet|Sem ranque
Swiftplay|极速模式|Быстрая игра|स्विफ़्टप्ले|スイフトプレイ|신속플레이|Partie rapide|Partida rápida|Swiftplay|Frenético
Deathmatch|死斗模式|Бой насмерть|डेथमैच|デスマッチ|데스매치|Combat à mort|Combate a muerte|Deathmatch|Mata-mata
Contracts|合约|Контракты|कॉन्ट्रैक्ट|契約|계약|Contrats|Contratos|Verträge|Contratos
Copy code|复制代码|Копировать код|कोड कॉपी करें|コードをコピー|코드 복사|Copier le code|Copiar código|Code kopieren|Copiar código
Crosshairs|准星|Прицелы|क्रॉसहेयर|クロスヘア|조준선|Viseurs|Miras|Fadenkreuze|Miras
Current|当前|Текущий|मौजूदा|現在|현재|Actuel|Actual|Aktuell|Atual
Damage by range|距离伤害|Урон по дистанции|दूरी के अनुसार डैमेज|距離別ダメージ|거리별 피해량|Dégâts selon la distance|Daño por distancia|Schaden nach Distanz|Dano por distância
Data folder|数据文件夹|Папка данных|डेटा फ़ोल्डर|データフォルダー|데이터 폴더|Dossier de données|Carpeta de datos|Datenordner|Pasta de dados
Draw|平局|Ничья|ड्रॉ|引き分け|무승부|Égalité|Empate|Unentschieden|Empate
Win|胜利|Победа|जीत|勝利|승리|Victoire|Victoria|Sieg|Vitória
Loss|失败|Поражение|हार|敗北|패배|Défaite|Derrota|Niederlage|Derrota
Earlier|更早|Ранее|पहले|以前|이전|Plus tôt|Antes|Früher|Antes
Elsewhere|其他游戏|В других играх|कहीं और|その他|다른 곳|Ailleurs|En otro juego|Woanders|Em outro lugar
Ends in|结束于|До конца|समाप्ति में|終了まで|종료까지|Se termine dans|Termina en|Endet in|Termina em
Resets in|刷新于|Обновление через|रीसेट में|リセットまで|초기화까지|Réinitialisation dans|Se renueva en|Neu in|Renova em
Enemies|敌人|Противники|दुश्मन|敵|적|Ennemis|Enemigos|Gegner|Inimigos
Enemy|敌方|Противник|दुश्मन|敵|적|Ennemi|Enemigo|Gegner|Inimigo
Enter invite code|输入邀请码|Введите код приглашения|इनवाइट कोड डालें|招待コードを入力|초대 코드 입력|Saisir le code d'invitation|Introduce el código|Einladungscode eingeben|Digite o código de convite
Everything|全部|Всё|सब कुछ|すべて|전체|Tout|Todo|Alles|Tudo
Experimental|实验功能|Экспериментальное|प्रायोगिक|試験機能|실험실|Expérimental|Experimental|Experimentell|Experimental
Filter|筛选|Фильтр|फ़िल्टर|フィルター|필터|Filtrer|Filtrar|Filter|Filtrar
Final rank|最终段位|Итоговый ранг|अंतिम रैंक|最終ランク|최종 랭크|Rang final|Rango final|Endrang|Rank final
Find a player|查找玩家|Найти игрока|खिलाड़ी खोजें|プレイヤーを探す|플레이어 찾기|Trouver un joueur|Buscar jugador|Spieler finden|Encontrar jogador
Friends & party|好友与小队|Друзья и группа|दोस्त और पार्टी|フレンドとパーティー|친구 및 파티|Amis et groupe|Amigos y grupo|Freunde & Gruppe|Amigos e grupo
Head|头部|Голова|सिर|頭|머리|Tête|Cabeza|Kopf|Cabeça
Body|身体|Тело|शरीर|胴体|몸통|Corps|Cuerpo|Körper|Corpo
Leg|腿部|Ноги|पैर|脚|다리|Jambes|Piernas|Beine|Pernas
Headshot|爆头|В голову|हेडशॉट|ヘッドショット|헤드샷|Tir à la tête|Tiro a la cabeza|Kopfschuss|Tiro na cabeça
Highest rank|最高段位|Высший ранг|सबसे ऊँची रैंक|最高ランク|최고 랭크|Rang le plus élevé|Rango más alto|Höchster Rang|Rank mais alto
Identity|身份|Профиль|पहचान|アイデンティティ|프로필 정보|Identité|Identidad|Identität|Identidade
Invite by Riot ID|通过 Riot ID 邀请|Пригласить по Riot ID|Riot ID से आमंत्रित करें|Riot IDで招待|Riot ID로 초대|Inviter par Riot ID|Invitar por Riot ID|Per Riot-ID einladen|Convidar por Riot ID
Invite code|邀请码|Код приглашения|इनवाइट कोड|招待コード|초대 코드|Code d'invitation|Código de invitación|Einladungscode|Código de convite
Invite to party|邀请入队|Пригласить в группу|पार्टी में बुलाएँ|パーティーに招待|파티 초대|Inviter dans le groupe|Invitar al grupo|In Gruppe einladen|Convidar para o grupo
Join party|加入小队|Войти в группу|पार्टी में शामिल हों|パーティーに参加|파티 참가|Rejoindre le groupe|Unirse al grupo|Gruppe beitreten|Entrar no grupo
Leave party|离开小队|Покинуть группу|पार्टी छोड़ें|パーティーを抜ける|파티 나가기|Quitter le groupe|Salir del grupo|Gruppe verlassen|Sair do grupo
Kick|踢出|Исключить|निकालें|キック|추방|Exclure|Expulsar|Entfernen|Expulsar
Later|稍后|Позже|बाद में|後で|나중에|Plus tard|Más tarde|Später|Depois
Level|等级|Уровень|स्तर|レベル|레벨|Niveau|Nivel|Stufe|Nível
Links|链接|Ссылки|लिंक|リンク|링크|Liens|Enlaces|Links|Links
Lobby & Party|大厅与小队|Лобби и группа|लॉबी और पार्टी|ロビーとパーティー|로비 및 파티|Salon et groupe|Sala y grupo|Lobby & Gruppe|Lobby e grupo
Lobby read|对局分析|Анализ лобби|लॉबी विश्लेषण|ロビー分析|로비 분석|Lecture du salon|Lectura de la sala|Lobby-Analyse|Leitura do lobby
Look up a player|查询玩家|Найти игрока|खिलाड़ी खोजें|プレイヤーを検索|플레이어 조회|Rechercher un joueur|Buscar un jugador|Spieler nachschlagen|Consultar jogador
Low-level accounts|低等级账号|Аккаунты низкого уровня|कम स्तर वाले खाते|低レベルアカウント|저레벨 계정|Comptes de bas niveau|Cuentas de nivel bajo|Konten mit niedriger Stufe|Contas de nível baixo
Match history|对局记录|История матчей|मैच इतिहास|マッチ履歴|전적|Historique des matchs|Historial de partidas|Match-Verlauf|Histórico de partidas
Mode|模式|Режим|मोड|モード|모드|Mode|Modo|Modus|Modo
Most played|最常使用|Чаще всего|सबसे ज़्यादा खेला|最多使用|가장 많이 플레이|Les plus joués|Más jugados|Meistgespielt|Mais jogados
Name|名称|Имя|नाम|名前|이름|Nom|Nombre|Name|Nome
Name changes|改名记录|Смены имени|नाम बदलाव|名前の変更|이름 변경|Changements de nom|Cambios de nombre|Namensänderungen|Mudanças de nome
Net RR|净 RR|Итог RR|कुल RR|合計RR|순 RR|RR net|RR neto|Netto-RR|RR líquido
Next rank|下一段位|Следующий ранг|अगली रैंक|次のランク|다음 랭크|Rang suivant|Siguiente rango|Nächster Rang|Próximo rank
Night market|夜市|Ночной рынок|नाइट मार्केट|ナイトマーケット|야시장|Marché nocturne|Mercado nocturno|Nachtmarkt|Mercado noturno
No friends yet|还没有好友|Друзей пока нет|अभी कोई दोस्त नहीं|フレンドはまだいません|아직 친구 없음|Aucun ami pour l'instant|Aún sin amigos|Noch keine Freunde|Ainda sem amigos
No matches|没有对局|Нет матчей|कोई मैच नहीं|マッチなし|매치 없음|Aucun match|Sin partidas|Keine Matches|Sem partidas
No matches found|未找到对局|Матчи не найдены|कोई मैच नहीं मिला|マッチが見つかりません|매치를 찾을 수 없음|Aucun match trouvé|No se encontraron partidas|Keine Matches gefunden|Nenhuma partida encontrada
No party|没有小队|Нет группы|कोई पार्टी नहीं|パーティーなし|파티 없음|Aucun groupe|Sin grupo|Keine Gruppe|Sem grupo
No skins found|未找到皮肤|Скины не найдены|कोई स्किन नहीं मिली|スキンが見つかりません|스킨을 찾을 수 없음|Aucun skin trouvé|No se encontraron skins|Keine Skins gefunden|Nenhuma skin encontrada
Nothing matches|没有匹配项|Ничего не найдено|कुछ नहीं मिला|一致なし|일치하는 항목 없음|Aucun résultat|Sin resultados|Keine Treffer|Nada encontrado
Nothing on your wishlist yet|愿望单还是空的|В списке желаний пока пусто|विशलिस्ट अभी खाली है|ウィッシュリストは空です|위시리스트가 비어 있음|Liste de souhaits vide|Tu lista de deseos está vacía|Wunschliste ist noch leer|Sua lista de desejos está vazia
Not in your store|不在你的商店中|Нет в вашем магазине|आपके स्टोर में नहीं|ストアにありません|상점에 없음|Pas dans votre boutique|No está en tu tienda|Nicht in deinem Shop|Não está na sua loja
In your daily offers|在你的每日商品中|В ежедневных предложениях|आपके दैनिक ऑफ़र में|デイリーオファーにあります|일일 상점에 있음|Dans vos offres du jour|En tus ofertas diarias|In deinen Tagesangeboten|Nas suas ofertas diárias
In your Night Market|在你的夜市中|В вашем ночном рынке|आपके नाइट मार्केट में|ナイトマーケットにあります|야시장에 있음|Dans votre marché nocturne|En tu mercado nocturno|In deinem Nachtmarkt|No seu mercado noturno
In a featured bundle|在精选套装中|В избранном наборе|फ़ीचर्ड बंडल में|注目のバンドルにあります|추천 묶음 상품에 있음|Dans un pack à la une|En un lote destacado|In einem Angebotspaket|Em um pacote em destaque
Not owned|未拥有|Нет в коллекции|आपके पास नहीं|未所持|미보유|Non possédé|No adquirido|Nicht im Besitz|Não adquirido
Offline|离线|Не в сети|ऑफ़लाइन|オフライン|오프라인|Hors ligne|Desconectado|Offline|Offline
Opacity|不透明度|Прозрачность|अपारदर्शिता|不透明度|불투명도|Opacité|Opacidad|Deckkraft|Opacidade
Open party|公开小队|Открытая группа|खुली पार्टी|オープンパーティー|공개 파티|Groupe ouvert|Grupo abierto|Offene Gruppe|Grupo aberto
Open profile|打开资料|Открыть профиль|प्रोफ़ाइल खोलें|プロフィールを開く|프로필 열기|Ouvrir le profil|Abrir perfil|Profil öffnen|Abrir perfil
View profile|查看资料|Посмотреть профиль|प्रोफ़ाइल देखें|プロフィールを見る|프로필 보기|Voir le profil|Ver perfil|Profil ansehen|Ver perfil
Overview|概览|Обзор|सारांश|概要|개요|Aperçu|Resumen|Übersicht|Visão geral
Party|小队|Группа|पार्टी|パーティー|파티|Groupe|Grupo|Gruppe|Grupo
Party leader|队长|Лидер группы|पार्टी लीडर|パーティーリーダー|파티장|Chef de groupe|Líder del grupo|Gruppenleiter|Líder do grupo
Played against|对战过|Играли против|खिलाफ़ खेले|対戦|상대로 만남|Joué contre|Jugaste contra|Gespielt gegen|Jogou contra
Played with|一起玩过|Играли вместе|साथ खेले|共闘|같은 팀|Joué avec|Jugaste con|Gespielt mit|Jogou com
Player|玩家|Игрок|खिलाड़ी|プレイヤー|플레이어|Joueur|Jugador|Spieler|Jogador
Player card|玩家卡面|Карточка игрока|प्लेयर कार्ड|プレイヤーカード|플레이어 카드|Carte de joueur|Tarjeta de jugador|Spielerkarte|Card de jogador
Premades|预组队|Группы|प्रीमेड|プリメイド|사전 구성 파티|Groupes formés|Grupos prearmados|Premades|Grupos fechados
Preview|预览|Предпросмотр|प्रीव्यू|プレビュー|미리보기|Aperçu|Vista previa|Vorschau|Prévia
Range|距离|Дистанция|दूरी|距離|거리|Portée|Distancia|Reichweite|Alcance
Rank|段位|Ранг|रैंक|ランク|랭크|Rang|Rango|Rang|Rank
Rank history|段位记录|История рангов|रैंक इतिहास|ランク履歴|랭크 기록|Historique des rangs|Historial de rangos|Rangverlauf|Histórico de ranks
Ranked trend|排位趋势|Тренд рейтинга|रैंक्ड रुझान|ランク推移|경쟁전 추세|Tendance classée|Tendencia competitiva|Ranglisten-Trend|Tendência ranqueada
Recent|最近|Недавние|हाल के|最近|최근|Récents|Recientes|Zuletzt|Recentes
Remove|移除|Удалить|हटाएँ|削除|제거|Retirer|Quitar|Entfernen|Remover
Remove from wishlist|从愿望单移除|Убрать из списка желаний|विशलिस्ट से हटाएँ|ウィッシュリストから削除|위시리스트에서 제거|Retirer de la liste de souhaits|Quitar de la lista de deseos|Von Wunschliste entfernen|Remover da lista de desejos
Add to wishlist|加入愿望单|В список желаний|विशलिस्ट में जोड़ें|ウィッシュリストに追加|위시리스트에 추가|Ajouter à la liste de souhaits|Añadir a la lista de deseos|Zur Wunschliste hinzufügen|Adicionar à lista de desejos
Rename|重命名|Переименовать|नाम बदलें|名前を変更|이름 변경|Renommer|Renombrar|Umbenennen|Renomear
Rounds|回合|Раунды|राउंड|ラウンド|라운드|Manches|Rondas|Runden|Rodadas
Scale|缩放|Масштаб|स्केल|スケール|크기|Échelle|Escala|Skalierung|Escala
Scoreboard|计分板|Таблица счёта|स्कोरबोर्ड|スコアボード|점수판|Tableau des scores|Marcador|Punktetafel|Placar
Scout|侦查|Разведка|स्काउट|スカウト|정찰|Analyser|Analizar|Scouten|Analisar
Search by name|按名称搜索|Поиск по имени|नाम से खोजें|名前で検索|이름으로 검색|Rechercher par nom|Buscar por nombre|Nach Name suchen|Buscar por nome
Search friends or notes|搜索好友或备注|Поиск друзей или заметок|दोस्त या नोट खोजें|フレンドやメモを検索|친구 또는 메모 검색|Rechercher amis ou notes|Buscar amigos o notas|Freunde oder Notizen suchen|Buscar amigos ou notas
Season|赛季|Сезон|सीज़न|シーズン|시즌|Saison|Temporada|Saison|Temporada
Sections|分区|Разделы|सेक्शन|セクション|섹션|Sections|Secciones|Abschnitte|Seções
Send|发送|Отправить|भेजें|送信|보내기|Envoyer|Enviar|Senden|Enviar
Send invite|发送邀请|Отправить приглашение|इनवाइट भेजें|招待を送信|초대 보내기|Envoyer l'invitation|Enviar invitación|Einladung senden|Enviar convite
Session|会话|Сессия|सेशन|セッション|세션|Session|Sesión|Sitzung|Sessão
This session|本次游戏|Эта сессия|यह सेशन|今回のセッション|이번 세션|Cette session|Esta sesión|Diese Sitzung|Esta sessão
Show peak rank|显示最高段位|Показывать пик ранга|सर्वोच्च रैंक दिखाएँ|最高ランクを表示|최고 랭크 표시|Afficher le rang record|Mostrar rango máximo|Höchstrang anzeigen|Mostrar rank máximo
Show that I use Spectre|显示我在使用 Spectre|Показывать, что я использую Spectre|दिखाएँ कि मैं Spectre इस्तेमाल करता हूँ|Spectreの利用を表示|Spectre 사용 표시|Montrer que j'utilise Spectre|Mostrar que uso Spectre|Zeigen, dass ich Spectre nutze|Mostrar que uso o Spectre
Skins|皮肤|Скины|स्किन|スキン|스킨|Skins|Skins|Skins|Skins
Something went wrong|出了点问题|Что-то пошло не так|कुछ गड़बड़ हो गई|問題が発生しました|문제가 발생했습니다|Une erreur s'est produite|Algo salió mal|Etwas ist schiefgelaufen|Algo deu errado
Status|状态|Статус|स्टेटस|ステータス|상태|Statut|Estado|Status|Status
Team average|队伍平均|Средний ранг команды|टीम औसत|チーム平均|팀 평균|Moyenne de l'équipe|Media del equipo|Team-Durchschnitt|Média do time
Teammates|队友|Союзники|टीम के साथी|味方|팀원|Coéquipiers|Compañeros|Teamkollegen|Aliados
Title|称号|Титул|टाइटल|タイトル|칭호|Titre|Título|Titel|Título
Top agents|常用特工|Лучшие агенты|टॉप एजेंट|よく使うエージェント|주요 요원|Agents favoris|Agentes principales|Top-Agenten|Principais agentes
Try again|重试|Повторить|फिर कोशिश करें|再試行|다시 시도|Réessayer|Reintentar|Erneut versuchen|Tentar de novo
Updates|更新|Обновления|अपडेट|アップデート|업데이트|Mises à jour|Actualizaciones|Updates|Atualizações
View on GitHub|在 GitHub 上查看|Открыть на GitHub|GitHub पर देखें|GitHubで見る|GitHub에서 보기|Voir sur GitHub|Ver en GitHub|Auf GitHub ansehen|Ver no GitHub
Waiting for the Riot Client|等待 Riot 客户端|Ожидание Riot Client|Riot Client का इंतज़ार|Riot Clientを待機中|Riot Client 대기 중|En attente du Riot Client|Esperando al Riot Client|Warte auf den Riot Client|Aguardando o Riot Client
Waiting for the Riot Client.|等待 Riot 客户端。|Ожидание Riot Client.|Riot Client का इंतज़ार।|Riot Clientを待機中。|Riot Client 대기 중.|En attente du Riot Client.|Esperando al Riot Client.|Warte auf den Riot Client.|Aguardando o Riot Client.
Waiting for the Riot Client...|等待 Riot 客户端...|Ожидание Riot Client...|Riot Client का इंतज़ार...|Riot Clientを待機中...|Riot Client 대기 중...|En attente du Riot Client...|Esperando al Riot Client...|Warte auf den Riot Client...|Aguardando o Riot Client...
With notes|有备注|С заметками|नोट वाले|メモあり|메모 있음|Avec notes|Con notas|Mit Notizen|Com notas
Your position|你的排名|Ваша позиция|आपकी स्थिति|あなたの順位|내 순위|Votre position|Tu posición|Deine Platzierung|Sua posição
Match MVP|全场 MVP|MVP матча|मैच MVP|マッチMVP|매치 MVP|MVP du match|MVP de la partida|Match-MVP|MVP da partida
Team MVP|队伍 MVP|MVP команды|टीम MVP|チームMVP|팀 MVP|MVP de l'équipe|MVP del equipo|Team-MVP|MVP do time
Evenly ranked|段位相当|Ранги примерно равны|रैंक लगभग बराबर|ランクは互角|랭크 비슷함|Rangs équilibrés|Rangos parejos|Ränge ausgeglichen|Ranks equilibrados
All solo|全部单排|Все соло|सभी सोलो|全員ソロ|모두 솔로|Tous en solo|Todos en solitario|Alle solo|Todos solo
Duo|双排|Дуо|डुओ|デュオ|듀오|Duo|Dúo|Duo|Dupla
Trio|三排|Трио|ट्रायो|トリオ|트리오|Trio|Trío|Trio|Trio
None at Platinum or above|铂金及以上没有|Нет на Платине и выше|प्लैटिनम या ऊपर कोई नहीं|プラチナ以上はなし|플래티넘 이상 없음|Aucun à Platine ou plus|Ninguna en Platino o superior|Keine ab Platin|Nenhuma em Platina ou acima
In menus|在菜单中|В меню|मेन्यू में|メニュー|메뉴|Dans les menus|En menús|In Menüs|Nos menus
In queue|匹配中|В очереди|कतार में|キュー中|대기열|En file|En cola|In Warteschlange|Na fila
Agent select|选择特工|Выбор агента|एजेंट चयन|エージェント選択|요원 선택|Sélection d'agent|Selección de agente|Agentenauswahl|Seleção de agente
In match|对局中|В матче|मैच में|マッチ中|매치 중|En match|En partida|Im Match|Em partida
Away|离开|Отошёл|दूर|離席中|자리 비움|Absent|Ausente|Abwesend|Ausente
`

export default {
  cols: ['en', 'zh', 'ru', 'hi', 'ja', 'ko', 'fr', 'es', 'de', 'pt'],
  rows: RAW.trim().split('\n').map(l => l.split('|')),
}
