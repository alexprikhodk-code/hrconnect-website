// Reproduction Test — 10 tasks measuring ability to accurately reproduce information
// Each task: show stimulus for N seconds → hide → ask question
window.REPRODUCTION_TASKS = [
  {
    showTime: 5,
    stimulus: { type: "colors", items: ["Червоний", "Синій", "Жовтий", "Зелений", "Фіолетовий"] },
    question: "Який колір був третім?",
    opts: ["Червоний", "Жовтий", "Зелений", "Синій"],
    ans: 1
  },
  {
    showTime: 5,
    stimulus: { type: "numbers", items: ["7", "3", "9", "1", "5", "8"] },
    question: "Яке число було на позиції 4?",
    opts: ["9", "1", "5", "3"],
    ans: 1
  },
  {
    showTime: 7,
    stimulus: { type: "text", items: ["Президент компанії підписав контракт на постачання обладнання у березні 2026"] },
    question: "Що саме було у контракті?",
    opts: ["Підписання угоди про продаж", "Постачання обладнання", "Купівля компанії", "Обмін активами"],
    ans: 1
  },
  {
    showTime: 4,
    stimulus: { type: "shapes", items: ["▲", "●", "■", "▼", "◆"] },
    question: "Яка фігура була другою?",
    opts: ["▲", "●", "■", "◆"],
    ans: 1
  },
  {
    showTime: 5,
    stimulus: { type: "words", items: ["стіл, книга, окуляри, чашка, ручка, олівець"] },
    question: "Скільки слів було показано?",
    opts: ["4", "5", "6", "7"],
    ans: 2
  },
  {
    showTime: 6,
    stimulus: { type: "instruction", items: ["Натисніть кнопку B, потім C, потім D, потім A"] },
    question: "Яка кнопка була остання у послідовності?",
    opts: ["A", "B", "C", "D"],
    ans: 0
  },
  {
    showTime: 6,
    stimulus: { type: "details", items: ["Зустріч призначена на 14 травня, 15:30, кабінет 207"] },
    question: "На котру годину призначена зустріч?",
    opts: ["14:30", "15:00", "15:30", "17:30"],
    ans: 2
  },
  {
    showTime: 5,
    stimulus: { type: "email", items: ["alex.prykhodko@hrconnect.com.ua"] },
    question: "Який домен у адресі?",
    opts: ["hrconnect.com", "hrconnect.ua", "hrconnect.com.ua", "hrconnect.co.ua"],
    ans: 2
  },
  {
    showTime: 7,
    stimulus: { type: "order", items: ["Спочатку — звіт", "Потім — нарада", "Далі — обід", "Наприкінці — презентація"] },
    question: "Що було третім у порядку?",
    opts: ["Звіт", "Нарада", "Обід", "Презентація"],
    ans: 2
  },
  {
    showTime: 7,
    stimulus: { type: "calc", items: ["Помножте 4 на 3", "Додайте 2", "Відніміть 7"] },
    question: "Який результат у вас вийшов?",
    opts: ["5", "7", "9", "11"],
    ans: 1
  }
];

// Score: % correct
window.reproductionBand = function (score) {
  if (score >= 80) return "Високий";
  if (score >= 65) return "Середній";
  if (score >= 50) return "Прийнятний";
  return "Низький";
};

window.reproductionSummary = function (score, band) {
  if (score >= 80) return "Дуже точно сприймає та відтворює інструкції. Підходить для керівних позицій, ролей з критичною важливістю деталей (фінанси, медицина, інженерія, авіація).";
  if (score >= 65) return "Прийнятний рівень відтворення. Сприймає завдання достатньо точно для більшості професійних ролей. Підходить для керівника нижньої ланки або спеціаліста.";
  if (score >= 50) return "Середній рівень. У звичних ситуаціях справляється, але під тиском або з новими завданнями може спотворювати інструкції. Рекомендовано додатковий контроль.";
  return "Низький рівень. Часто спотворює або забуває деталі. Не рекомендовано для ролей з керуванням обладнанням, критичних виробничих процесів або складних послідовностей дій.";
};
