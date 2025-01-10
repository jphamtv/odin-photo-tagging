import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
// import SideBar from '../components/SideBar';
// import GameBoard from '../components/GameBoard';
import { GameStatus, Target, ValidationRequest } from '../types/gameTypes';
import { targetService } from '../services/targetService';
import { scoreService } from '../services/scoreService';
import styles from './Game.module.css';

interface Feedback {
  message: string;
  isSuccess: boolean;
}

export default function Game() {
  const navigate = useNavigate();
  const [gameStatus, setGameStatus] = useState<GameStatus>('not-started');  
  const [targets, setTargets] = useState<Target[]>([]);
  const [foundTargets, setFoundTargets] = useState<number[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    // Start game when component mounts
    handleGameStart();
  }, []);

  useEffect(() => {
    let intervalId: number;

    if (gameStatus === 'in-progress') {
      // Start client-side timer for display only
      intervalId = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [gameStatus]);

  const handleGameStart = async () => {
    try {
      const targets = await targetService.getTargets();
      console.log(targets)
      setTargets(targets);
      setGameStatus('in-progress');
      await scoreService.startTimer();
    } catch (err) {
      setError('Failed to start game');
      console.error('Error starting game: ', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTargetValidation = async (request: ValidationRequest) => {
    try {
      const { success, message } = await targetService.verifyLocation(
        request.id,
        request.xCoord,
        request.yCoord
      );

      // Show feedback
      setFeedback({ message, isSuccess: success });

      // Clear feedback after 2 seconds
      setTimeout(() => setFeedback(null), 2000);

      if (success) {
        const updatedFoundTargets = [...foundTargets, request.id];
        setFoundTargets(updatedFoundTargets);

        // Check if game is complete
        if (updatedFoundTargets.length === targets.length) {
          handleGameEnd();
        }
      }

      return { success, message };
    } catch (err) {
      setError('Failed to verify target');
      console.error('Error verifying target: ', err);
      return { success: false, message: 'Error verifying target' };
    }
  };

  const handleGameEnd = async () => {
    try {
      const response = await scoreService.stopTimer();
      setGameStatus('completed');
      // Use server's final time_seconds for display
      setElapsedTime(response.timeSeconds);
    } catch (err) {
      setError('Failed to end game');
      console.error('Error ending game: ', err);
    }
  };
  
  const handleScoreSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const username = formData.get('username') as string;
      await scoreService.submitScore(username);           
      navigate('/'); 
    } catch (err) {
      setError('Failed to submit score');
      console.error('Error submitting score: ', err);
    }    
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <main className={styles.container}>
      <Header timer={elapsedTime} />
      {feedback && (
        <div
          className={`${styles.feedbackBanner} ${
            feedback.isSuccess ? styles.success : styles.error
          }`}
        >
          {feedback.message}
        </div>
      )}
      {/* <SideBar targets={targets} foundTargets={foundTargets} />
      <GameBoard onClick={handleTargetValidation} /> */}

      {gameStatus === 'completed' && (
        <>
          <div className={styles.modalOverlay} />
          <div className={styles.completionModal}>
            <h2>Congratulations!</h2>
            <p>You found all the artists in {elapsedTime} seconds!</p>
            <form onSubmit={handleScoreSubmit}>
              <input
                type="text"
                name="username"
                maxLength={3}
                placeholder='Enter 3 initials'
                required
                autoFocus
              />
              <button type="submit">Submit Score</button>
            </form>
          </div>
        </>
      )}
    </main>
  );
}