export type Question = {
  id: string;
  prompt: string;
  answers: string[];
};

export const questions: Question[] = [
  {
    id: 'q1',
    prompt: 'Birinci sınıf meyvelerden 4 tane yaz.',
    answers: ['elma', 'armut', 'muz', 'çilek', 'kiraz'],
  },
  {
    id: 'q2',
    prompt: 'Bir yazılım projesinde kullanılan rollerden 4 tane yaz.',
    answers: ['geliştirici', 'tasarımcı', 'ürün yöneticisi', 'test mühendisi', 'devops'],
  },
  {
    id: 'q3',
    prompt: 'Güneş sistemindeki gezegenlerden 4 tane yaz.',
    answers: ['merkur', 'venüs', 'dünya', 'mars', 'jüpiter', 'satürn', 'uranüs', 'neptün'],
  },
  {
    id: 'q4',
    prompt: 'Türkiye’de büyük şehirlerden 4 tane yaz.',
    answers: ['istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana'],
  },
  {
    id: 'q5',
    prompt: 'Bir kahvaltı sofrasında olabilecek 4 şey yaz.',
    answers: ['yumurta', 'zeytin', 'peynir', 'domates', 'salatalık', 'ekmek', 'reçel'],
  },
];
