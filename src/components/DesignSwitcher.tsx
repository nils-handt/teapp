import { IonButton, IonButtons, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonContent } from '@ionic/react';
import { apps } from 'ionicons/icons';
import React, { useState } from 'react';
import { useHistory } from 'react-router';

const DesignSwitcher: React.FC = () => {
    const history = useHistory();
    const [showPopover, setShowPopover] = useState<{ open: boolean, event: Event | undefined }>({
        open: false,
        event: undefined,
    });

    const designs = [
        { id: 1, name: 'Zen', path: '/tabs/brewing/1' },
        { id: 2, name: 'Lab', path: '/tabs/brewing/2' },
        { id: 3, name: 'Flow', path: '/tabs/brewing/3' },
        { id: 4, name: 'Card', path: '/tabs/brewing/4' },
        { id: 5, name: 'Focus', path: '/tabs/brewing/5' },
        { id: 6, name: 'Old', path: '/tabs/brewing/6' },
    ];

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
                        {designs.map((d) => (
                            <IonItem key={d.id} button onClick={() => {
                                history.push(d.path);
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
