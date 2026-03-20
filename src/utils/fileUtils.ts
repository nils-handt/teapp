import { Share } from '@capacitor/share';
import { isPlatform } from '@ionic/react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

/**
 * Shares a file.
 * On web: Triggers a file download.
 * On native: Uses the system share sheet.
 * 
 * @param fileName The name of the file to share (e.g., 'data.json')
 * @param data The data to share. Can be a string or a JSON object.
 * @param mimeType The MIME type of the file. Defaults to 'application/json'.
 */
export const shareFile = async (
    fileName: string,
    data: string | object,
    mimeType: string = 'application/json'
): Promise<void> => {
    try {
        const stringData = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;

        if (isPlatform('desktop') || isPlatform('pwa') || isPlatform('mobileweb')) {
            // Web platform fallback: Download the file
            const blob = new Blob([stringData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Native platform: Use Share plugin
            // First write the file to the cache directory
            await Filesystem.writeFile({
                path: fileName,
                data: stringData,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });

            const result = await Filesystem.getUri({
                path: fileName,
                directory: Directory.Cache
            });

            await Share.share({
                title: 'Share File',
                text: `Sharing file: ${fileName}`,
                url: result.uri,
                dialogTitle: 'Share File'
            });
        }
    } catch (error) {
        console.error('Error sharing file:', error);
        throw error;
    }
};
