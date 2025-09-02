import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useStopwatch } from 'react-timer-hook';

interface TimeEntry {
  id: string;
  started_at: string;
  ended_at?: string;
  paused_seconds: number;
  branch_id?: string;
  activity_id?: string;
  notes?: string;
}

interface TimerContextType {
  isTracking: boolean;
  isPaused: boolean;
  currentEntry: TimeEntry | null;
  pauseStartedAt: Date | null;
  stopwatch: {
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
    isRunning: boolean;
    start: () => void;
    pause: () => void;
    reset: (expiryTimestamp?: Date, autoStart?: boolean) => void;
    totalSeconds: number;
  };
  startTimer: (branchId: string, activityId: string, notes?: string) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  resumeExistingEntry: (entry: TimeEntry) => Promise<void>;
  discardExistingEntry: (entry: TimeEntry) => Promise<void>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [pauseStartedAt, setPauseStartedAt] = useState<Date | null>(null);
  
  const stopwatch = useStopwatch({ autoStart: false });
  const { start, pause, reset, totalSeconds, seconds, minutes, hours, days, isRunning } = stopwatch;

  // Check for existing unfinished entries on mount
  useEffect(() => {
    checkForExistingEntry();
  }, []);

  const checkForExistingEntry = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (entries && entries.length > 0) {
        const entry = entries[0];
        setCurrentEntry(entry);
        
        // Calculate elapsed time and resume timer
        const startTime = new Date(entry.started_at);
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000) - entry.paused_seconds;
        
        // Set timer to continue from where it left off
        const futureTime = new Date();
        futureTime.setSeconds(futureTime.getSeconds() + 1);
        reset(futureTime, true);
        
        // Manually set the elapsed time
        stopwatch.totalSeconds = elapsedSeconds;
        
        setIsTracking(true);
        setIsPaused(false);
      }
    } catch (error: any) {
      console.error('Error checking for existing entries:', error);
    }
  };

  const startTimer = async (branchId: string, activityId: string, notes?: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      const { data: entry, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.user.id,
          branch_id: branchId,
          activity_id: activityId,
          started_at: new Date().toISOString(),
          notes: notes || null
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentEntry(entry);
      setIsTracking(true);
      setIsPaused(false);
      setPauseStartedAt(null);
      
      start();

      toast({
        title: "Timer gestartet",
        description: "Die Zeiterfassung wurde gestartet."
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Timer konnte nicht gestartet werden.",
        variant: "destructive"
      });
    }
  };

  const pauseTimer = async () => {
    if (!currentEntry) return;

    try {
      pause();
      setIsPaused(true);
      setPauseStartedAt(new Date());

      toast({
        title: "Timer pausiert",
        description: "Die Zeiterfassung wurde pausiert."
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Timer konnte nicht pausiert werden.",
        variant: "destructive"
      });
    }
  };

  const resumeTimer = async () => {
    if (!currentEntry || !pauseStartedAt) return;

    try {
      const totalPauseTime = Math.floor((Date.now() - pauseStartedAt.getTime()) / 1000);
      
      const { error } = await supabase
        .from('time_entries')
        .update({ paused_seconds: currentEntry.paused_seconds + totalPauseTime })
        .eq('id', currentEntry.id);

      if (error) throw error;

      setCurrentEntry(prev => prev ? { ...prev, paused_seconds: prev.paused_seconds + totalPauseTime } : null);
      setIsPaused(false);
      setPauseStartedAt(null);
      
      start();

      toast({
        title: "Timer fortgesetzt",
        description: "Die Zeiterfassung wurde fortgesetzt."
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Timer konnte nicht fortgesetzt werden.",
        variant: "destructive"
      });
    }
  };

  const stopTimer = async () => {
    if (!currentEntry) return;

    try {
      let finalPausedSeconds = currentEntry.paused_seconds;
      
      if (isPaused && pauseStartedAt) {
        const additionalPauseTime = Math.floor((Date.now() - pauseStartedAt.getTime()) / 1000);
        finalPausedSeconds += additionalPauseTime;
      }

      const { error } = await supabase
        .from('time_entries')
        .update({
          ended_at: new Date().toISOString(),
          paused_seconds: finalPausedSeconds
        })
        .eq('id', currentEntry.id);

      if (error) throw error;

      // Reset all states
      setCurrentEntry(null);
      setIsTracking(false);
      setIsPaused(false);
      setPauseStartedAt(null);
      
      reset();

      toast({
        title: "Timer gestoppt",
        description: "Die Zeiterfassung wurde beendet."
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Timer konnte nicht gestoppt werden.",
        variant: "destructive"
      });
    }
  };

  const resumeExistingEntry = async (entry: TimeEntry) => {
    setCurrentEntry(entry);
    setIsTracking(true);
    setIsPaused(false);
    setPauseStartedAt(null);
    
    // Calculate elapsed time and resume timer
    const startTime = new Date(entry.started_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000) - entry.paused_seconds;
    
    // Set timer to continue from where it left off
    const futureTime = new Date();
    futureTime.setSeconds(futureTime.getSeconds() + 1);
    reset(futureTime, true);
    
    toast({
      title: "Timer fortgesetzt",
      description: "Die vorherige Zeiterfassung wurde fortgesetzt."
    });
  };

  const discardExistingEntry = async (entry: TimeEntry) => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (error) throw error;

      toast({
        title: "Eintrag beendet",
        description: "Der vorherige Eintrag wurde beendet."
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Eintrag konnte nicht beendet werden.",
        variant: "destructive"
      });
    }
  };

  const value: TimerContextType = {
    isTracking,
    isPaused,
    currentEntry,
    pauseStartedAt,
    stopwatch: {
      seconds,
      minutes,
      hours,
      days,
      isRunning,
      start,
      pause,
      reset,
      totalSeconds
    },
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resumeExistingEntry,
    discardExistingEntry
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}