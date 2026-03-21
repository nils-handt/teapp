import { useState } from 'react';
import { IonAlert } from '@ionic/react';
import { useStore } from '../stores/useStore';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { bluetoothScaleService } from '../services/BluetoothScaleService';
import { createLogger } from '../services/logging';

const logger = createLogger('BrewingControl');

export const useBrewingControl = () => {
    const { weightLoggerEnabled, isRecording, startRecording, stopRecording, discardRecording } = useStore();
    const [showSaveAlert, setShowSaveAlert] = useState(false);

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
            setShowSaveAlert(true);
        }
    };

    const recordingAlert = (
        <IonAlert
            isOpen={showSaveAlert}
            onDidDismiss={() => setShowSaveAlert(false)}
            header={'Save Recording'}
            inputs={[
                {
                    name: 'sessionName',
                    type: 'text',
                    placeholder: 'Session Name',
                    value: `Session ${new Date().toLocaleTimeString()}`
                },
                {
                    name: 'notes',
                    type: 'text',
                    placeholder: 'Notes (optional)'
                }
            ]}
            buttons={[
                {
                    text: 'Cancel',
                    role: 'cancel',
                    cssClass: 'secondary',
                    handler: () => {
                        logger.info('Discarding recording from end-session prompt');
                        discardRecording();
                    }
                },
                {
                    text: 'Save',
                    handler: (data) => {
                        logger.info('Saving recording from end-session prompt', { sessionName: data.sessionName });
                        stopRecording(data.sessionName, data.notes);
                    }
                }
            ]}
        />
    );

    return {
        startBrewingSession,
        handleEndSession,
        recordingAlert
    };
};
