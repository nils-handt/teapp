import { useState } from 'react';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { bluetoothScaleService } from '../services/BluetoothScaleService';
import { createLogger } from '../services/logging';
import { useShallow } from 'zustand/react/shallow';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import RecordingSaveModal from '../components/RecordingSaveModal';

const logger = createLogger('BrewingControl');

export const useBrewingControl = () => {
    const weightLoggerEnabled = useSettingsStore((state) => state.weightLoggerEnabled);
    const { isRecording, startRecording, stopRecording, discardRecording } = useRecordingStore(
        useShallow((state) => ({
            isRecording: state.isRecording,
            startRecording: state.startRecording,
            stopRecording: state.stopRecording,
            discardRecording: state.discardRecording,
        }))
    );
    const [showSaveAlert, setShowSaveAlert] = useState(false);
    const [recordingSessionName, setRecordingSessionName] = useState('');

    const startBrewingSession = (teaName?: string) => {
        logger.info('Starting brewing session from UI', { teaName: teaName ?? '' });
        // Core session start
        brewingSessionService.startSession(teaName);

        // Auto-start recording if enabled and not already recording
        if (weightLoggerEnabled && !isRecording) {
            logger.info('Auto-starting weight recording for brewing session');
            startRecording();
        }

        // Auto-start mock replay if in mock mode and recording is loaded
        if (bluetoothScaleService.isMockMode) {
            logger.info('Auto-starting mock replay for brewing session');
            // Check if mock has data (accessing via public mock getter if available or cast)
            // The service exposes 'mock' getter
            const mockService = bluetoothScaleService.mock;
            // We can't easily check mockService.recording.length efficiently without public access or just calling startReplay which handles checks
            mockService.startReplay();
        }
    };

    const handleEndSession = async () => {
        logger.info('Ending brewing session from UI');
        // End core session
        await brewingSessionService.endSession();

        // Stop mock replay
        if (bluetoothScaleService.isMockMode) {
            bluetoothScaleService.mock.stopReplay();
        }

        // Handle recording stop
        if (isRecording) {
            logger.info('Prompting to save active weight recording after session end');
            setRecordingSessionName(`Session ${new Date().toLocaleTimeString()}`);
            setShowSaveAlert(true);
        }
    };

    const handleUndoEndSession = async () => {
        logger.info('Undoing end-session request');
        await brewingSessionService.undoEndSession();
        setShowSaveAlert(false);

        if (bluetoothScaleService.isMockMode) {
            bluetoothScaleService.mock.startReplay();
        }
    };

    const recordingAlert = (
        <RecordingSaveModal
            isOpen={showSaveAlert}
            initialSessionName={recordingSessionName}
            onCancel={() => {
                logger.info('Discarding recording from end-session prompt');
                discardRecording();
                setShowSaveAlert(false);
            }}
            onSave={(sessionName, notes) => {
                logger.info('Saving recording from end-session prompt', { sessionName });
                stopRecording(sessionName, notes);
                setShowSaveAlert(false);
            }}
        />
    );

    return {
        startBrewingSession,
        handleEndSession,
        handleUndoEndSession,
        recordingAlert
    };
};
