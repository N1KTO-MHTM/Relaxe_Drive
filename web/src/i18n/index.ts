import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';
import ka from './locales/ka.json';
import es from './locales/es.json';

const resources = { en: { translation: en }, ru: { translation: ru }, ka: { translation: ka }, es: { translation: es } };

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('relaxdrive-locale') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => localStorage.setItem('relaxdrive-locale', lng));

export default i18n;
