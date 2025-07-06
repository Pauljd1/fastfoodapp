import { ID } from "react-native-appwrite";
import { appwriteConfig, databases, storage } from "./appwrite";
import dummyData from "./data";

interface Category {
    name: string;
    description: string;
}

interface Customization {
    name: string;
    price: number;
    type: "topping" | "side" | "size" | "crust" | string; // extend as needed
}

interface MenuItem {
    name: string;
    description: string;
    image_url: string;
    price: number;
    rating: number;
    calories: number;
    protein: number;
    category_name: string;
    customizations: string[]; // list of customization names
}

interface DummyData {
    categories: Category[];
    customizations: Customization[];
    menu: MenuItem[];
}

// ensure dummyData has correct shape
const data = dummyData as DummyData;

async function clearAll(collectionId: string): Promise<void> {
    try {
        console.log(`Clearing collection: ${collectionId}`);
        const list = await databases.listDocuments(
            appwriteConfig.databaseId,
            collectionId
        );

        if (list.documents.length > 0) {
            await Promise.all(
                list.documents.map((doc) =>
                    databases.deleteDocument(appwriteConfig.databaseId, collectionId, doc.$id)
                        .catch(err => console.warn(`Failed to delete document ${doc.$id}:`, err))
                )
            );
        } else {
            console.log(`No documents found in collection ${collectionId}`);
        }
    } catch (error) {
        console.warn(`Error clearing collection ${collectionId}:`, error);
        // Continue execution instead of failing completely
    }
}

async function clearStorage(): Promise<void> {
    try {
        console.log(`Clearing storage bucket: ${appwriteConfig.bucketId}`);
        const list = await storage.listFiles(appwriteConfig.bucketId);

        if (list.files.length > 0) {
            await Promise.all(
                list.files.map((file) =>
                    storage.deleteFile(appwriteConfig.bucketId, file.$id)
                        .catch(err => console.warn(`Failed to delete file ${file.$id}:`, err))
                )
            );
        } else {
            console.log('No files found in storage bucket');
        }
    } catch (error) {
        console.warn('Error clearing storage:', error);
        // Continue execution instead of failing completely
    }
}

async function uploadImageToStorage(imageUrl: string) {
    try {
        console.log(`Uploading image from: ${imageUrl}`);

        // Add timeout to fetch operation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(imageUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'image/*',
                    'Cache-Control': 'no-cache'
                }
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();

            const fileObj = {
                name: imageUrl.split("/").pop() || `file-${Date.now()}.jpg`,
                type: blob.type || 'image/jpeg',
                size: blob.size,
                uri: imageUrl,
            };

            console.log(`Creating file in Appwrite storage: ${fileObj.name}`);
            const file = await storage.createFile(
                appwriteConfig.bucketId,
                ID.unique(),
                fileObj
            );

            const fileUrl = storage.getFileViewURL(appwriteConfig.bucketId, file.$id);
            console.log(`File uploaded successfully: ${file.$id}`);
            return fileUrl;
        } catch (fetchError) {
            clearTimeout(timeoutId);

            // If we can't fetch the image, use a placeholder
            console.warn(`Failed to fetch image from ${imageUrl}:`, fetchError);
            console.log('Using placeholder image instead');

            // Create a placeholder image file
            const placeholderUrl = 'https://ui-avatars.com/api/?name=Food&size=200&background=random';
            const placeholderResponse = await fetch(placeholderUrl);
            const placeholderBlob = await placeholderResponse.blob();

            const placeholderObj = {
                name: `placeholder-${Date.now()}.jpg`,
                type: 'image/jpeg',
                size: placeholderBlob.size,
                uri: placeholderUrl,
            };

            const file = await storage.createFile(
                appwriteConfig.bucketId,
                ID.unique(),
                placeholderObj
            );

            return storage.getFileViewURL(appwriteConfig.bucketId, file.$id);
        }
    } catch (error) {
        console.error('Error in uploadImageToStorage:', error);
        throw error;
    }
}

async function seed(): Promise<void> {
    try {
        console.log("Starting database seeding...");

        // Test Appwrite connection first
        try {
            // Simple test query to verify connection
            await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.categoriesCollectionId,
                []
            );
            console.log("✅ Connection to Appwrite successful");
        } catch (error) {
            console.error("⚠️ Failed to connect to Appwrite:", error);
            throw new Error(`Connection test failed: ${error}`);
        }

        // 1. Clear all
        await clearAll(appwriteConfig.categoriesCollectionId);
        await clearAll(appwriteConfig.customizationsCollectionId);
        await clearAll(appwriteConfig.menuCollectionId);
        await clearAll(appwriteConfig.menuCustomizationsCollectionId);
        await clearStorage();

    // 2. Create Categories
    const categoryMap: Record<string, string> = {};
    for (const cat of data.categories) {
        const doc = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.categoriesCollectionId,
            ID.unique(),
            cat
        );
        categoryMap[cat.name] = doc.$id;
    }

    // 3. Create Customizations
    const customizationMap: Record<string, string> = {};
    for (const cus of data.customizations) {
        const doc = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.customizationsCollectionId,
            ID.unique(),
            {
                name: cus.name,
                price: cus.price,
                type: cus.type,
            }
        );
        customizationMap[cus.name] = doc.$id;
    }

    // 4. Create Menu Items
    const menuMap: Record<string, string> = {};
    for (const item of data.menu) {
        const uploadedImage = await uploadImageToStorage(item.image_url);

        const doc = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.menuCollectionId,
            ID.unique(),
            {
                name: item.name,
                description: item.description,
                image_url: uploadedImage,
                price: item.price,
                rating: item.rating,
                calories: item.calories,
                protein: item.protein,
                categories: categoryMap[item.category_name],
            }
        );

        menuMap[item.name] = doc.$id;

        // 5. Create menu_customizations
        for (const cusName of item.customizations) {
            await databases.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.menuCustomizationsCollectionId,
                ID.unique(),
                {
                    menu: doc.$id,
                    customizations: customizationMap[cusName],
                }
            );
        }
    }

    console.log("✅ Seeding complete.");
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        throw error;
    }
}

// Wrapper function that handles retries
async function seedWithRetry(maxRetries = 3): Promise<void> {
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            attempts++;
            console.log(`Seeding attempt ${attempts}/${maxRetries}`);
            await seed();
            console.log("Database seeded successfully!");
            return;
        } catch (error) {
            console.error(`Attempt ${attempts} failed:`, error);

            if (attempts >= maxRetries) {
                console.error(`All ${maxRetries} attempts failed. Giving up.`);
                throw error;
            }

            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
            console.log(`Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export default seedWithRetry;