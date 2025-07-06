import { CreateUserParams, GetMenuParams, SignInParams } from "@/type";
import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  Query,
  Storage,
} from "react-native-appwrite";

export const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  platform: "com.dvsn.foodordering",
  databaseId: "6868e85f0030b31ffa38",
  bucketId: "686a1633002e683006d3",
  userCollectionId: "6868e87d0039185334e4",
  categoriesCollectionId: "686a10e20035d5aaf174",
  menuCollectionId: "686a12540004feab05d4",
  customizationsCollectionId: "686a13a900317465b08c",
  menuCustomizationsCollectionId: "686a14d30035392df3aa",
};

export const client = new Client();

try {
  client
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setPlatform(appwriteConfig.platform);
  console.log("Appwrite endpoint:", appwriteConfig.endpoint);
  console.log("Project ID:", appwriteConfig.projectId);
} catch (error) {
  console.error("Failed to initialize Appwrite client:", error);
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
const avatars = new Avatars(client);

export const createUser = async ({
  email,
  password,
  name,
}: CreateUserParams) => {
  try {
    const newAccount = await account.create(ID.unique(), email, password, name);
    if (!newAccount) throw new Error("Failed to create user");
    await signIn({ email, password });

    // Generate a valid URL for the avatar
    // Using a placeholder image URL from a reliable source
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=random`;

    return await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      { accountId: newAccount.$id, email, name, avatar: avatarUrl }
    );
  } catch (e) {
    throw new Error(e as string);
  }
};

export const signIn = async ({ email, password }: SignInParams) => {
  try {
    const Session = await account.createEmailPasswordSession(email, password);
  } catch (e) {
    throw new Error(e as string);
  }
};

export const getCurrentUser = async () => {
  try {
    const currentAccount = await account.get();
    if (!currentAccount) throw Error;
    const currentUser = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal("accountId", currentAccount.$id)]
    );
    if (!currentUser) throw Error;
    return currentUser.documents[0];
  } catch (e) {
    console.log(Error);
    throw new Error(e as string);
  }
};

export const getMenu = async ({ category, query }: GetMenuParams) => {
  try {
    const quries: string[] = [];

    if (category) quries.push(Query.equal("categories", category));
    if (query) quries.push(Query.search("name", query));

    const menus = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.menuCollectionId,
      quries
    );
    return menus.documents;
  } catch (e) {
    throw new Error(e as string);
  }
};

export const getCategories = async () => {
  try {
    const categories = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.categoriesCollectionId
    );
    return categories.documents;
  } catch (e) {
    throw new Error(e as string);
  }
};
