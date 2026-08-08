// js/storage.js
export class Storage {
    static async uploadImage(file, path = 'products') {
        try {
            if (typeof firebase === 'undefined' || !firebase.storage) {
                console.warn('⚠️ Firebase Storage not available');
                return null;
            }
            
            const storageRef = firebase.storage().ref();
            const fileName = `${Date.now()}_${file.name}`;
            const fileRef = storageRef.child(`${path}/${fileName}`);
            
            const uploadTask = fileRef.put(file);
            
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`📤 Upload progress: ${progress.toFixed(1)}%`);
                    },
                    (error) => {
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(downloadURL);
                    }
                );
            });
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
    
    static async deleteImage(url) {
        try {
            if (!url || typeof firebase === 'undefined' || !firebase.storage) {
                return;
            }
            const ref = firebase.storage().refFromURL(url);
            await ref.delete();
        } catch (error) {
            console.warn('Delete error:', error);
        }
    }
}