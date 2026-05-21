export const company = {
  name: "PrintCare",
  city: "Санкт-Петербург",
  address: "п. Мурино, ул. Оборонная, д. 2к3",
  addressShort: "Мурино, Оборонная 2к3",
  phone: "+7 (965) 022-42-99",
  phoneTel: "+79650224299",
  email: "info@printcare.ru",
  // Год основания. Считается «лет на рынке» автоматически от текущего года.
  foundedYear: 2007,
  workingHours: {
    weekday: "Пн–Пт 9:00 — 20:00",
    saturday: "Сб 10:00 — 18:00",
    sunday: "Вс — по согласованию",
  },
  yandexMapsUrl:
    "https://yandex.ru/maps/?text=" +
    encodeURIComponent("Санкт-Петербург, п. Мурино, ул. Оборонная, 2к3"),
};

/**
 * Команда мастеров. Добавили нового — карточка появится автоматом.
 * `photo` — путь от /public, чтобы Next/Image мог обрабатывать.
 * Если фото нет, оставьте `null` — отрисуется стилизованный аватар-инициал.
 */
export const team = [
  {
    name: "Данил Котелевский",
    role: "Руководитель",
    speciality: "Лазерные принтеры HP, Canon, Samsung · 18+ лет в нише",
    years: yearsSince(2007),
    photo: "/team/danil.jpg",
    quote:
      "Большинство «поломок» — это просто несвоевременная заправка или износ узла, который ещё можно поменять. Главное — вовремя посмотреть и не врать клиенту.",
  },
];

/** Цифры для секции «о компании». Меняются раз в год — храним руками. */
export const companyStats = {
  yearsOnMarket: yearsSince(2007),
  cartridgesRefilled: "24 000+",
  printersRepaired: "3 200+",
  loyalClients: "600+",
};

function yearsSince(year: number) {
  return new Date().getFullYear() - year;
}
