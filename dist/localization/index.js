"use strict";
/**
 * Localization system for the Telegram Bot
 * Supporting multiple languages with easy-to-use translation functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTranslation = exports.getTranslation = exports.LANGUAGE_OPTIONS = void 0;
// Language names with their emoji flag
exports.LANGUAGE_OPTIONS = {
    en: { name: 'English', flag: '🇬🇧' },
    es: { name: 'Español', flag: '🇪🇸' },
    fr: { name: 'Français', flag: '🇫🇷' },
    ru: { name: 'Русский', flag: '🇷🇺' },
    pt: { name: 'Português', flag: '🇵🇹' },
    ar: { name: 'العربية', flag: '🇸🇦' },
    zh: { name: '中文', flag: '🇨🇳' },
    hi: { name: 'हिन्दी', flag: '🇮🇳' },
    bn: { name: 'বাংলা', flag: '🇧🇩' },
    ja: { name: '日本語', flag: '🇯🇵' }
};
// Define translations for each language
const translations = {
    en: {
        welcome_message: 'Welcome to the TON Connect Bot! Use /connect to link your wallet.',
        connect_wallet_instructions: 'Scan the QR code or click the button below to connect your wallet.',
        wallet_connected: 'Your wallet has been successfully connected!',
        wallet_disconnected: 'Your wallet has been disconnected.',
        send_transaction_instructions: 'Please confirm the transaction in your wallet.',
        transaction_sent: 'Transaction sent successfully!',
        transaction_error: 'There was an error sending your transaction. Please try again.',
        help_message: 'Available commands:\n/connect - Connect your wallet\n/disconnect - Disconnect your wallet\n/wallet - Show your wallet information\n/send - Send a transaction\n/support - Get help from our team\n/language - Change language\n/info - Bot information and help',
        support_instructions: 'Please enter your message after the /support command.',
        support_message_received: 'Thank you for your message. Our team will respond soon.',
        admin_notification: 'New support message received.',
        transaction_approved: 'Your transaction has been approved.',
        transaction_rejected: 'Your transaction has been rejected.',
        language_selection: 'Please select your preferred language:',
        language_changed: 'Language changed to English!',
        tutorial_welcome: 'Welcome to the tutorial! I\'ll guide you through using this bot.',
        tutorial_step_completed: 'Great job! Let\'s continue to the next step.',
        tutorial_completed: 'Congratulations! You\'ve completed the tutorial.'
    },
    es: {
        welcome_message: '¡Bienvenido al Bot TON Connect! Usa /connect para vincular tu billetera.',
        connect_wallet_instructions: 'Escanea el código QR o haz clic en el botón de abajo para conectar tu billetera.',
        wallet_connected: '¡Tu billetera ha sido conectada exitosamente!',
        wallet_disconnected: 'Tu billetera ha sido desconectada.',
        send_transaction_instructions: 'Por favor, confirma la transacción en tu billetera.',
        transaction_sent: '¡Transacción enviada con éxito!',
        transaction_error: 'Hubo un error al enviar tu transacción. Por favor, inténtalo de nuevo.',
        help_message: 'Comandos disponibles:\n/connect - Conectar tu billetera\n/disconnect - Desconectar tu billetera\n/wallet - Mostrar información de tu billetera\n/send - Enviar una transacción\n/support - Obtener ayuda de nuestro equipo\n/language - Cambiar idioma\n/info - Información del bot y ayuda',
        support_instructions: 'Por favor, ingresa tu mensaje después del comando /support.',
        support_message_received: 'Gracias por tu mensaje. Nuestro equipo responderá pronto.',
        admin_notification: 'Nuevo mensaje de soporte recibido.',
        transaction_approved: 'Tu transacción ha sido aprobada.',
        transaction_rejected: 'Tu transacción ha sido rechazada.',
        language_selection: 'Por favor, selecciona tu idioma preferido:',
        language_changed: '¡Idioma cambiado a Español!',
        tutorial_welcome: '¡Bienvenido al tutorial! Te guiaré a través del uso de este bot.',
        tutorial_step_completed: '¡Buen trabajo! Continuemos con el siguiente paso.',
        tutorial_completed: '¡Felicidades! Has completado el tutorial.'
    },
    fr: {
        welcome_message: 'Bienvenue sur le Bot TON Connect ! Utilisez /connect pour lier votre portefeuille.',
        connect_wallet_instructions: 'Scannez le code QR ou cliquez sur le bouton ci-dessous pour connecter votre portefeuille.',
        wallet_connected: 'Votre portefeuille a été connecté avec succès !',
        wallet_disconnected: 'Votre portefeuille a été déconnecté.',
        send_transaction_instructions: 'Veuillez confirmer la transaction dans votre portefeuille.',
        transaction_sent: 'Transaction envoyée avec succès !',
        transaction_error: 'Une erreur s\'est produite lors de l\'envoi de votre transaction. Veuillez réessayer.',
        help_message: 'Commandes disponibles:\n/connect - Connecter votre portefeuille\n/disconnect - Déconnecter votre portefeuille\n/wallet - Afficher les informations de votre portefeuille\n/send - Envoyer une transaction\n/support - Obtenir de l\'aide de notre équipe\n/language - Changer de langue\n/info - Informations sur le bot et aide',
        support_instructions: 'Veuillez entrer votre message après la commande /support.',
        support_message_received: 'Merci pour votre message. Notre équipe vous répondra bientôt.',
        admin_notification: 'Nouveau message de support reçu.',
        transaction_approved: 'Votre transaction a été approuvée.',
        transaction_rejected: 'Votre transaction a été rejetée.',
        language_selection: 'Veuillez sélectionner votre langue préférée :',
        language_changed: 'Langue changée en Français !',
        tutorial_welcome: 'Bienvenue dans le tutoriel ! Je vais vous guider dans l\'utilisation de ce bot.',
        tutorial_step_completed: 'Bon travail ! Continuons à l\'étape suivante.',
        tutorial_completed: 'Félicitations ! Vous avez terminé le tutoriel.'
    },
    ru: {
        welcome_message: 'Добро пожаловать в бот TON Connect! Используйте /connect, чтобы подключить свой кошелек.',
        connect_wallet_instructions: 'Отсканируйте QR-код или нажмите на кнопку ниже, чтобы подключить свой кошелек.',
        wallet_connected: 'Ваш кошелек успешно подключен!',
        wallet_disconnected: 'Ваш кошелек был отключен.',
        send_transaction_instructions: 'Пожалуйста, подтвердите транзакцию в своем кошельке.',
        transaction_sent: 'Транзакция успешно отправлена!',
        transaction_error: 'Произошла ошибка при отправке вашей транзакции. Пожалуйста, попробуйте еще раз.',
        help_message: 'Доступные команды:\n/connect - Подключить кошелек\n/disconnect - Отключить кошелек\n/wallet - Показать информацию о кошельке\n/send - Отправить транзакцию\n/support - Получить помощь от нашей команды\n/language - Изменить язык\n/info - Информация о боте и помощь',
        support_instructions: 'Пожалуйста, введите ваше сообщение после команды /support.',
        support_message_received: 'Спасибо за ваше сообщение. Наша команда ответит в ближайшее время.',
        admin_notification: 'Получено новое сообщение в поддержку.',
        transaction_approved: 'Ваша транзакция была одобрена.',
        transaction_rejected: 'Ваша транзакция была отклонена.',
        language_selection: 'Пожалуйста, выберите предпочитаемый язык:',
        language_changed: 'Язык изменен на Русский!',
        tutorial_welcome: 'Добро пожаловать в обучение! Я проведу вас через использование этого бота.',
        tutorial_step_completed: 'Отличная работа! Давайте перейдем к следующему шагу.',
        tutorial_completed: 'Поздравляем! Вы завершили обучение.'
    },
    pt: {
        welcome_message: 'Bem-vindo ao Bot TON Connect! Use /connect para vincular sua carteira.',
        connect_wallet_instructions: 'Escaneie o código QR ou clique no botão abaixo para conectar sua carteira.',
        wallet_connected: 'Sua carteira foi conectada com sucesso!',
        wallet_disconnected: 'Sua carteira foi desconectada.',
        send_transaction_instructions: 'Por favor, confirme a transação em sua carteira.',
        transaction_sent: 'Transação enviada com sucesso!',
        transaction_error: 'Ocorreu um erro ao enviar sua transação. Por favor, tente novamente.',
        help_message: 'Comandos disponíveis:\n/connect - Conectar sua carteira\n/disconnect - Desconectar sua carteira\n/wallet - Mostrar informações da sua carteira\n/send - Enviar uma transação\n/support - Obter ajuda da nossa equipe\n/language - Alterar idioma\n/info - Informações do bot e ajuda',
        support_instructions: 'Por favor, digite sua mensagem após o comando /support.',
        support_message_received: 'Obrigado pela sua mensagem. Nossa equipe responderá em breve.',
        admin_notification: 'Nova mensagem de suporte recebida.',
        transaction_approved: 'Sua transação foi aprovada.',
        transaction_rejected: 'Sua transação foi rejeitada.',
        language_selection: 'Por favor, selecione seu idioma preferido:',
        language_changed: 'Idioma alterado para Português!',
        tutorial_welcome: 'Bem-vindo ao tutorial! Vou guiá-lo pelo uso deste bot.',
        tutorial_step_completed: 'Ótimo trabalho! Vamos continuar para o próximo passo.',
        tutorial_completed: 'Parabéns! Você completou o tutorial.'
    },
    ar: {
        welcome_message: 'مرحبًا بك في بوت TON Connect! استخدم /connect لربط محفظتك.',
        connect_wallet_instructions: 'امسح رمز الاستجابة السريعة أو انقر على الزر أدناه لتوصيل محفظتك.',
        wallet_connected: 'تم توصيل محفظتك بنجاح!',
        wallet_disconnected: 'تم فصل محفظتك.',
        send_transaction_instructions: 'يرجى تأكيد المعاملة في محفظتك.',
        transaction_sent: 'تم إرسال المعاملة بنجاح!',
        transaction_error: 'حدث خطأ أثناء إرسال معاملتك. يرجى المحاولة مرة أخرى.',
        help_message: 'الأوامر المتاحة:\n/connect - توصيل محفظتك\n/disconnect - فصل محفظتك\n/wallet - عرض معلومات محفظتك\n/send - إرسال معاملة\n/support - الحصول على مساعدة من فريقنا\n/language - تغيير اللغة\n/info - معلومات البوت ومساعدة',
        support_instructions: 'الرجاء إدخال رسالتك بعد الأمر /support.',
        support_message_received: 'شكرًا على رسالتك. سيرد فريقنا قريبًا.',
        admin_notification: 'تم استلام رسالة دعم جديدة.',
        transaction_approved: 'تمت الموافقة على معاملتك.',
        transaction_rejected: 'تم رفض معاملتك.',
        language_selection: 'الرجاء اختيار لغتك المفضلة:',
        language_changed: 'تم تغيير اللغة إلى العربية!',
        tutorial_welcome: 'مرحبًا بك في البرنامج التعليمي! سأرشدك خلال استخدام هذا البوت.',
        tutorial_step_completed: 'عمل رائع! دعنا نواصل إلى الخطوة التالية.',
        tutorial_completed: 'تهانينا! لقد أكملت البرنامج التعليمي.'
    },
    zh: {
        welcome_message: '欢迎使用 TON Connect 机器人！使用 /connect 连接您的钱包。',
        connect_wallet_instructions: '扫描二维码或点击下面的按钮连接您的钱包。',
        wallet_connected: '您的钱包已成功连接！',
        wallet_disconnected: '您的钱包已断开连接。',
        send_transaction_instructions: '请在您的钱包中确认交易。',
        transaction_sent: '交易发送成功！',
        transaction_error: '发送交易时出错。请重试。',
        help_message: '可用命令:\n/connect - 连接您的钱包\n/disconnect - 断开您的钱包连接\n/wallet - 显示您的钱包信息\n/send - 发送交易\n/support - 获取我们团队的帮助\n/language - 更改语言\n/info - 机器人信息和帮助',
        support_instructions: '请在 /support 命令后输入您的消息。',
        support_message_received: '谢谢您的留言。我们的团队将很快回复。',
        admin_notification: '收到新的支持消息。',
        transaction_approved: '您的交易已获批准。',
        transaction_rejected: '您的交易已被拒绝。',
        language_selection: '请选择您的首选语言：',
        language_changed: '语言已更改为中文！',
        tutorial_welcome: '欢迎来到教程！我将指导您使用这个机器人。',
        tutorial_step_completed: '做得好！让我们继续下一步。',
        tutorial_completed: '恭喜！您已完成教程。'
    },
    hi: {
        welcome_message: 'TON Connect बॉट में आपका स्वागत है! अपना वॉलेट लिंक करने के लिए /connect का उपयोग करें।',
        connect_wallet_instructions: 'अपना वॉलेट कनेक्ट करने के लिए QR कोड स्कैन करें या नीचे दिए गए बटन पर क्लिक करें।',
        wallet_connected: 'आपका वॉलेट सफलतापूर्वक कनेक्ट किया गया है!',
        wallet_disconnected: 'आपका वॉलेट डिस्कनेक्ट कर दिया गया है।',
        send_transaction_instructions: 'कृपया अपने वॉलेट में लेनदेन की पुष्टि करें।',
        transaction_sent: 'लेनदेन सफलतापूर्वक भेजा गया!',
        transaction_error: 'आपका लेनदेन भेजने में एक त्रुटि हुई। कृपया पुनः प्रयास करें।',
        help_message: 'उपलब्ध आदेश:\n/connect - अपना वॉलेट कनेक्ट करें\n/disconnect - अपना वॉलेट डिस्कनेक्ट करें\n/wallet - अपने वॉलेट की जानकारी देखें\n/send - लेनदेन भेजें\n/support - हमारी टीम से सहायता प्राप्त करें\n/language - भाषा बदलें\n/info - बॉट की जानकारी और सहायता',
        support_instructions: 'कृपया /support आदेश के बाद अपना संदेश दर्ज करें।',
        support_message_received: 'आपके संदेश के लिए धन्यवाद। हमारी टीम जल्द ही जवाब देगी।',
        admin_notification: 'नया सपोर्ट संदेश प्राप्त हुआ।',
        transaction_approved: 'आपके लेनदेन को मंजूरी दे दी गई है।',
        transaction_rejected: 'आपका लेनदेन अस्वीकार कर दिया गया है।',
        language_selection: 'कृपया अपनी पसंदीदा भाषा चुनें:',
        language_changed: 'भाषा हिंदी में बदल दी गई है!',
        tutorial_welcome: 'ट्यूटोरियल में आपका स्वागत है! मैं आपको इस बॉट का उपयोग करने के लिए मार्गदर्शन करूंगा।',
        tutorial_step_completed: 'बहुत अच्छा! आइए अगले चरण पर चलते हैं।',
        tutorial_completed: 'बधाई हो! आपने ट्यूटोरियल पूरा कर लिया है।'
    },
    bn: {
        welcome_message: 'TON Connect বট-এ আপনাকে স্বাগতম! আপনার ওয়ালেট লিঙ্ক করতে /connect ব্যবহার করুন।',
        connect_wallet_instructions: 'আপনার ওয়ালেট সংযোগ করতে QR কোড স্ক্যান করুন বা নিচের বাটনে ক্লিক করুন।',
        wallet_connected: 'আপনার ওয়ালেট সফলভাবে সংযুক্ত হয়েছে!',
        wallet_disconnected: 'আপনার ওয়ালেট বিচ্ছিন্ন করা হয়েছে।',
        send_transaction_instructions: 'অনুগ্রহ করে আপনার ওয়ালেটে লেনদেন নিশ্চিত করুন।',
        transaction_sent: 'লেনদেন সফলভাবে প্রেরিত হয়েছে!',
        transaction_error: 'আপনার লেনদেন প্রেরণে একটি ত্রুটি ছিল। অনুগ্রহ করে আবার চেষ্টা করুন।',
        help_message: 'উপলব্ধ কমান্ড:\n/connect - আপনার ওয়ালেট সংযোগ করুন\n/disconnect - আপনার ওয়ালেট বিচ্ছিন্ন করুন\n/wallet - আপনার ওয়ালেট তথ্য দেখান\n/send - লেনদেন পাঠান\n/support - আমাদের টিম থেকে সাহায্য পান\n/language - ভাষা পরিবর্তন করুন\n/info - বট তথ্য এবং সাহায্য',
        support_instructions: 'অনুগ্রহ করে /support কমান্ডের পরে আপনার বার্তা লিখুন।',
        support_message_received: 'আপনার বার্তার জন্য ধন্যবাদ। আমাদের টিম শীঘ্রই উত্তর দেবে।',
        admin_notification: 'নতুন সাপোর্ট বার্তা প্রাপ্ত হয়েছে।',
        transaction_approved: 'আপনার লেনদেন অনুমোদিত হয়েছে।',
        transaction_rejected: 'আপনার লেনদেন প্রত্যাখ্যান করা হয়েছে।',
        language_selection: 'অনুগ্রহ করে আপনার পছন্দের ভাষা নির্বাচন করুন:',
        language_changed: 'ভাষা বাংলায় পরিবর্তন করা হয়েছে!',
        tutorial_welcome: 'টিউটোরিয়ালে আপনাকে স্বাগতম! আমি আপনাকে এই বট ব্যবহার করার পথে নির্দেশনা দেব।',
        tutorial_step_completed: 'দারুণ কাজ! চলুন পরবর্তী ধাপে যাই।',
        tutorial_completed: 'অভিনন্দন! আপনি টিউটোরিয়াল সম্পূর্ণ করেছেন।'
    },
    ja: {
        welcome_message: 'TON Connect ボットへようこそ！ウォレットをリンクするには /connect を使用してください。',
        connect_wallet_instructions: 'QRコードをスキャンするか、下のボタンをクリックしてウォレットを接続してください。',
        wallet_connected: 'ウォレットが正常に接続されました！',
        wallet_disconnected: 'ウォレットが切断されました。',
        send_transaction_instructions: 'ウォレットでトランザクションを確認してください。',
        transaction_sent: 'トランザクションが正常に送信されました！',
        transaction_error: 'トランザクションの送信中にエラーが発生しました。もう一度お試しください。',
        help_message: '利用可能なコマンド:\n/connect - ウォレットを接続する\n/disconnect - ウォレットを切断する\n/wallet - ウォレット情報を表示する\n/send - トランザクションを送信する\n/support - チームからのサポートを受ける\n/language - 言語を変更する\n/info - ボット情報とヘルプ',
        support_instructions: '/support コマンドの後にメッセージを入力してください。',
        support_message_received: 'メッセージをありがとうございます。チームがまもなく返信します。',
        admin_notification: '新しいサポートメッセージを受信しました。',
        transaction_approved: 'あなたのトランザクションが承認されました。',
        transaction_rejected: 'あなたのトランザクションが拒否されました。',
        language_selection: '希望する言語を選択してください：',
        language_changed: '言語が日本語に変更されました！',
        tutorial_welcome: 'チュートリアルへようこそ！このボットの使い方をご案内します。',
        tutorial_step_completed: '素晴らしい！次のステップに進みましょう。',
        tutorial_completed: 'おめでとうございます！チュートリアルが完了しました。'
    }
};
/**
 * Get a translated message for the specified key and language
 * @param key Translation key
 * @param lang Language code
 * @returns Translated message
 */
function getTranslation(key, lang = 'en') {
    // Default to English if translation is missing
    if (!translations[lang] || !translations[lang][key]) {
        return translations.en[key];
    }
    return translations[lang][key];
}
exports.getTranslation = getTranslation;
/**
 * Format a translation with placeholders
 * @param key Translation key
 * @param lang Language code
 * @param params Parameters to substitute in the translation
 * @returns Formatted translated message
 */
function formatTranslation(key, lang = 'en', params = {}) {
    let text = getTranslation(key, lang);
    // Replace parameters
    Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(`{{${paramKey}}}`, String(paramValue));
    });
    return text;
}
exports.formatTranslation = formatTranslation;
//# sourceMappingURL=index.js.map