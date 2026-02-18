import React, { useEffect, useState } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonAlert,
    IonRefresher,
    IonRefresherContent
} from '@ionic/react';
import { trashOutline, shareOutline } from 'ionicons/icons';
import { shareFile } from '../utils/fileUtils';
import { weightLoggerService } from '../services/WeightLoggerService';
import { useStore } from '../stores/useStore';

const RecordingsScreen: React.FC = () => {
    const { refreshRecordings, savedRecordings } = useStore();
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);

    useEffect(() => {
        refreshRecordings();
    }, [refreshRecordings]);

    const handleRefresh = async (event: CustomEvent) => {
        await refreshRecordings();
        event.detail.complete();
    };

    const handleShare = async (fileName: string) => {
        try {
            const recording = await weightLoggerService.loadRecording(fileName);
            if (!recording) {
                console.error('Failed to load recording for download');
                return;
            }
            await shareFile(fileName, recording);
        } catch (error) {
            console.error('Error sharing file:', error);
            // Fallback or alert user
        }
    };

    const handleDelete = async () => {
        if (fileToDelete) {
            await weightLoggerService.deleteRecording(fileToDelete);
            await refreshRecordings();
            setFileToDelete(null);
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/tabs/settings" />
                    </IonButtons>
                    <IonTitle>Recordings</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>

                <IonList>
                    {savedRecordings.length === 0 ? (
                        <IonItem>
                            <IonLabel className="ion-text-center p-4">
                                No recordings found.
                                <p>Enable Weight Logger in Settings and record a session in Brewing screen.</p>
                            </IonLabel>
                        </IonItem>
                    ) : (
                        savedRecordings.map((fileName) => (
                            <IonItem key={fileName}>
                                <IonLabel>
                                    <h2>{fileName}</h2>
                                    {/* Parsing timestamp from filename or loading content could be expensive for list, 
                      so just showing filename is fine for now/MVP */}
                                </IonLabel>
                                <IonButtons slot="end">
                                    <IonButton onClick={() => handleShare(fileName)}>
                                        <IonIcon slot="icon-only" icon={shareOutline} />
                                    </IonButton>
                                    <IonButton color="danger" onClick={() => setFileToDelete(fileName)}>
                                        <IonIcon slot="icon-only" icon={trashOutline} />
                                    </IonButton>
                                </IonButtons>
                            </IonItem>
                        ))
                    )}
                </IonList>

                <IonAlert
                    isOpen={!!fileToDelete}
                    onDidDismiss={() => setFileToDelete(null)}
                    header={'Delete Recording'}
                    message={`Are you sure you want to delete ${fileToDelete}?`}
                    buttons={[
                        {
                            text: 'Cancel',
                            role: 'cancel',
                            handler: () => setFileToDelete(null)
                        },
                        {
                            text: 'Delete',
                            role: 'destructive',
                            handler: handleDelete
                        }
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default RecordingsScreen;
