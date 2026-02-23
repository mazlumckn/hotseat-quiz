import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Question, questions } from './src/data/questions';

type AppScreen = 'LOBBY' | 'GAME' | 'RESULT';
type Phase = 'PREVIEW' | 'ANSWERING_P1' | 'ANSWERING_P2' | 'SCORING';
type PlayerKey = 'p1' | 'p2';

type ScoreState = {
  p1: number;
  p2: number;
};

type ScoringContext = {
  message: string;
  awardedTo?: PlayerKey;
};

const PREVIEW_SECONDS = 10;
const ANSWERING_SECONDS = 10;
const SCORING_SECONDS = 2;
const WIN_SCORE = 3;

const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('LOBBY');
  const [player1Name, setPlayer1Name] = useState('Oyuncu 1');
  const [player2Name, setPlayer2Name] = useState('Oyuncu 2');

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('PREVIEW');
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_SECONDS);
  const [scores, setScores] = useState<ScoreState>({ p1: 0, p2: 0 });
  const [answerInput, setAnswerInput] = useState('');
  const [foundAnswers, setFoundAnswers] = useState<string[]>([]);
  const [scoringContext, setScoringContext] = useState<ScoringContext>({ message: '' });

  const currentQuestion: Question = questions[questionIndex % questions.length];

  const allAnswers = useMemo(
    () => currentQuestion.answers.map((answer) => normalize(answer)),
    [currentQuestion],
  );

  const winnerName = useMemo(() => {
    if (scores.p1 >= WIN_SCORE) {
      return player1Name || 'Oyuncu 1';
    }

    if (scores.p2 >= WIN_SCORE) {
      return player2Name || 'Oyuncu 2';
    }

    return '';
  }, [player1Name, player2Name, scores.p1, scores.p2]);

  useEffect(() => {
    if (screen !== 'GAME') {
      return;
    }

    if (secondsLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [screen, phase, secondsLeft]);

  const moveToPhase = (nextPhase: Phase) => {
    setPhase(nextPhase);

    if (nextPhase === 'PREVIEW') {
      setSecondsLeft(PREVIEW_SECONDS);
      return;
    }

    if (nextPhase === 'ANSWERING_P1' || nextPhase === 'ANSWERING_P2') {
      setSecondsLeft(ANSWERING_SECONDS);
      return;
    }

    setSecondsLeft(SCORING_SECONDS);
  };

  const moveToScoring = ({ message, awardedTo }: ScoringContext) => {
    setScoringContext({ message, awardedTo });

    if (awardedTo) {
      setScores((prev) => ({
        ...prev,
        [awardedTo]: prev[awardedTo] + 1,
      }));
    }

    moveToPhase('SCORING');
    setAnswerInput('');
  };

  const nextQuestion = () => {
    setQuestionIndex((prev) => prev + 1);
    moveToPhase('PREVIEW');
    setAnswerInput('');
    setFoundAnswers([]);
    setScoringContext({ message: '' });
  };

  useEffect(() => {
    if (screen !== 'GAME' || secondsLeft !== 0) {
      return;
    }

    if (phase === 'PREVIEW') {
      moveToPhase('ANSWERING_P1');
      return;
    }

    if (phase === 'ANSWERING_P1') {
      moveToScoring({
        awardedTo: 'p2',
        message: `${player2Name || 'Oyuncu 2'} +1 puan kazandı (P1 süresi doldu).`,
      });
      return;
    }

    if (phase === 'ANSWERING_P2') {
      moveToScoring({
        awardedTo: 'p1',
        message: `${player1Name || 'Oyuncu 1'} +1 puan kazandı (P2 süresi doldu).`,
      });
      return;
    }

    if (phase === 'SCORING') {
      if (winnerName) {
        setScreen('RESULT');
      } else {
        nextQuestion();
      }
    }
  }, [phase, player1Name, player2Name, screen, secondsLeft, winnerName]);

  const startGame = () => {
    setScreen('GAME');
    setQuestionIndex(0);
    moveToPhase('PREVIEW');
    setScores({ p1: 0, p2: 0 });
    setFoundAnswers([]);
    setAnswerInput('');
    setScoringContext({ message: '' });
  };

  const restartGame = () => {
    setScreen('LOBBY');
    setScores({ p1: 0, p2: 0 });
    setQuestionIndex(0);
    moveToPhase('PREVIEW');
    setFoundAnswers([]);
    setAnswerInput('');
    setScoringContext({ message: '' });
  };

  const submitAnswer = () => {
    if (phase !== 'ANSWERING_P1' && phase !== 'ANSWERING_P2') {
      return;
    }

    const normalizedInput = normalize(answerInput);

    if (!normalizedInput) {
      return;
    }

    if (foundAnswers.includes(normalizedInput)) {
      setScoringContext({ message: 'Bu cevap zaten yazıldı, duplicate cevap kabul edilmez.' });
      setAnswerInput('');
      return;
    }

    if (!allAnswers.includes(normalizedInput)) {
      setScoringContext({ message: 'Bu cevap doğru değil. Aynı oyuncu devam edebilir.' });
      setAnswerInput('');
      return;
    }

    const nextFoundAnswers = [...foundAnswers, normalizedInput];
    setFoundAnswers(nextFoundAnswers);
    setAnswerInput('');
    setScoringContext({ message: '' });

    if (nextFoundAnswers.length === allAnswers.length) {
      moveToScoring({
        message: 'Tüm doğru cevaplar yazıldı. Bu turda puan yok, sonraki soruya geçiliyor.',
      });
      return;
    }

    if (phase === 'ANSWERING_P1') {
      moveToPhase('ANSWERING_P2');
      return;
    }

    moveToScoring({
      message: 'İki oyuncu da cevap verdi. Sonraki soruya geçiliyor.',
    });
  };

  const activePlayerLabel =
    phase === 'ANSWERING_P1'
      ? player1Name || 'Oyuncu 1'
      : phase === 'ANSWERING_P2'
        ? player2Name || 'Oyuncu 2'
        : '-';

  const revealedAnswers = currentQuestion.answers.filter((answer) =>
    foundAnswers.includes(normalize(answer)),
  );

  if (screen === 'LOBBY') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Hot-Seat Quiz</Text>
        <Text style={styles.subtitle}>Tek cihazda 2 oyuncu yarışır</Text>

        <TextInput
          style={styles.input}
          value={player1Name}
          onChangeText={setPlayer1Name}
          placeholder="Oyuncu 1 adı"
        />
        <TextInput
          style={styles.input}
          value={player2Name}
          onChangeText={setPlayer2Name}
          placeholder="Oyuncu 2 adı"
        />

        <Pressable style={styles.button} onPress={startGame}>
          <Text style={styles.buttonText}>Oyunu Başlat</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (screen === 'RESULT') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Oyun Bitti</Text>
        <Text style={styles.winner}>{winnerName} kazandı! 🏆</Text>
        <Text style={styles.scoreLine}>
          Skor: {player1Name} {scores.p1} - {scores.p2} {player2Name}
        </Text>

        <Pressable style={styles.button} onPress={restartGame}>
          <Text style={styles.buttonText}>Yeniden Başlat</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.roundLabel}>Soru {questionIndex + 1}</Text>
      <Text style={styles.question}>{currentQuestion.prompt}</Text>

      <View style={styles.scoreboard}>
        <Text style={styles.scoreLine}>
          {player1Name}: {scores.p1}
        </Text>
        <Text style={styles.scoreLine}>
          {player2Name}: {scores.p2}
        </Text>
      </View>

      <Text style={styles.phaseText}>Faz: {phase}</Text>
      <Text style={styles.timer}>Kalan Süre: {secondsLeft}s</Text>
      <Text style={styles.activePlayer}>Aktif Oyuncu: {activePlayerLabel}</Text>

      {(phase === 'ANSWERING_P1' || phase === 'ANSWERING_P2') && (
        <View style={styles.answerBox}>
          <TextInput
            style={styles.input}
            value={answerInput}
            onChangeText={setAnswerInput}
            placeholder="Cevap yaz..."
            onSubmitEditing={submitAnswer}
          />
          <Pressable style={styles.button} onPress={submitAnswer}>
            <Text style={styles.buttonText}>Gönder</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.answersList}>
        <Text style={styles.answersTitle}>Bulunan Doğru Cevaplar</Text>
        {revealedAnswers.length === 0 ? (
          <Text style={styles.placeholder}>Henüz doğru cevap yok.</Text>
        ) : (
          revealedAnswers.map((answer) => (
            <Text key={answer} style={styles.answerItem}>
              • {answer}
            </Text>
          ))
        )}
      </View>

      <View style={styles.answersList}>
        <Text style={styles.answersTitle}>Doğru Cevaplar</Text>
        {currentQuestion.answers.map((answer) => (
          <Text key={answer} style={styles.answerItem}>
            • {answer}
          </Text>
        ))}
      </View>

      {!!scoringContext.message && (
        <View style={styles.scoringPanel}>
          <Text style={styles.scoringText}>{scoringContext.message}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  roundLabel: {
    fontSize: 18,
    textAlign: 'center',
    color: '#444',
  },
  question: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#355cff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  scoreLine: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  phaseText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#555',
  },
  timer: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  activePlayer: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
  answerBox: {
    gap: 10,
  },
  answersList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 90,
  },
  answersTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  answerItem: {
    fontSize: 15,
    marginBottom: 4,
  },
  placeholder: {
    fontSize: 14,
    color: '#777',
  },
  scoringPanel: {
    backgroundColor: '#e9efff',
    borderWidth: 1,
    borderColor: '#c5d3ff',
    borderRadius: 8,
    padding: 12,
  },
  scoringText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  winner: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
});
