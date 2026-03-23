import { IonButton, IonButtons, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonContent } from '@ionic/react';
import { apps } from 'ionicons/icons';
import React, { useState } from 'react';
import { useHistory } from 'react-router';
import { BREWING_SCREEN_OPTIONS, getBrewingScreenPath } from '../constants/brewingScreens';
import { useSettingsStore } from '../stores/useSettingsStore';

const DesignSwitcher: React.FC = () => {
    const history = useHistory();
    const updateSettings = useSettingsStore((state) => state.updateSettings);
    const [showPopover, setShowPopover] = useState<{ open: boolean, event: Event | undefined }>({
        open: false,
        event: undefined,
    });

    return (
        <>
            <IonButtons slot="end">
                <IonButton onClick={(e) => setShowPopover({ open: true, event: e.nativeEvent })}>
                    <IonIcon icon={apps} />
                </IonButton>
            </IonButtons>
            <IonPopover
                isOpen={showPopover.open}
                event={showPopover.event}
                onDidDismiss={() => setShowPopover({ open: false, event: undefined })}
            >
                <IonContent>
                    <IonList>
                        {BREWING_SCREEN_OPTIONS.map((d) => (
                            <IonItem key={d.id} button onClick={() => {
                                updateSettings({ lastUsedBrewingScreen: d.id });
                                history.push(getBrewingScreenPath(d.id));
                                setShowPopover({ open: false, event: undefined });
                            }}>
                                <IonLabel>{d.id}. {d.name}</IonLabel>
                            </IonItem>
                        ))}
                    </IonList>
                </IonContent>
            </IonPopover>
        </>
    );
};

export default DesignSwitcher;
