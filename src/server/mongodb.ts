import mongoose, { type Connection, type Mongoose } from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/parktru";

let cachedClient: Connection | null = null;
let cachedDb: Mongoose | null = null;

const connectToDatabase = async (): Promise<Mongoose | undefined> => {
	try {
		if (cachedClient && cachedDb) {
			return;
		}

		const client = await mongoose.connect(uri);

		const connection = mongoose.connection;
		connection.on("connected", () => {
			console.log("Connected to MongoDB");
		});

		connection.on("error", (err) => {
			console.error("MongoDB connection error:", err);
			// Log error but allow application to continue running
			cachedClient = null;
			cachedDb = null;
		});

		cachedClient = client.connection;
		cachedDb = mongoose;
		return mongoose;
	} catch (error) {
		console.error("Error connecting to MongoDB:", error);
		throw error;
	}
};

export default connectToDatabase;
