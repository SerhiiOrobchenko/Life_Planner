# Android-обёртка «Мой день» (Capacitor)
Приложение открывает сайт https://serhiiorobchenko.github.io/Life_Planner/ и добавляет нативные
уведомления (LocalNotifications) и распознавание речи. Веб-код обновляется без пересборки APK.
Сборка: `npm i && npx cap sync android && cd android && MOYDEN_KEYPASS=… MOYDEN_KEYSTORE=… ./gradlew assembleRelease`.
Ключ подписи хранится в приватном репозитории Life_Planner_Data/signing.
