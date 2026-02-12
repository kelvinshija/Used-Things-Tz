import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase Configuration
const supabaseUrl = 'https://emlyorzigcsidyeeyzpc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbHlvcnppZ2NzaWR5ZWV5enBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTI3NjIsImV4cCI6MjA4NjQyODc2Mn0.MYmqHtFFku3vAo8PphRr-jYNbBqLNbx7DjsO6w28dTo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Schema Creation SQL (Run this in Supabase SQL Editor)
export const databaseSchema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    phone_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    country_code VARCHAR(10),
    role VARCHAR(50) DEFAULT 'user',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    condition VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    seller_phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'available',
    views_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Product categories table
CREATE TABLE IF NOT EXISTS product_categories (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

-- CHAT SYSTEM TABLES --

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    last_message TEXT,
    last_message_time TIMESTAMP,
    buyer_unread_count INTEGER DEFAULT 0,
    seller_unread_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(buyer_id, seller_id, product_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    image_url TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_product_id ON favorites(product_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX idx_conversations_product_id ON conversations(product_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Anyone can view available products" ON products
    FOR SELECT USING (status = 'available');

CREATE POLICY "Sellers can manage their products" ON products
    FOR ALL USING (auth.uid() = seller_id);

CREATE POLICY "Users can manage their favorites" ON favorites
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their conversations" ON conversations
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can send messages to their conversations" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND 
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = conversation_id 
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

-- Insert default categories
INSERT INTO categories (name, slug, icon) VALUES
    ('Electronics', 'electronics', 'fa-mobile-alt'),
    ('Furniture', 'furniture', 'fa-couch'),
    ('Clothing', 'clothing', 'fa-tshirt'),
    ('Vehicles', 'vehicles', 'fa-car'),
    ('Books', 'books', 'fa-book'),
    ('Sports', 'sports', 'fa-futbol'),
    ('Other', 'other', 'fa-tag')
ON CONFLICT (slug) DO NOTHING;

-- Insert countries
INSERT INTO countries (name, code, phone_code) VALUES
    ('Tanzania', 'TZ', '255'),
    ('Kenya', 'KE', '254'),
    ('Uganda', 'UG', '256'),
    ('Rwanda', 'RW', '250'),
    ('Burundi', 'BI', '257')
ON CONFLICT DO NOTHING;

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`

// Authentication Functions
export const auth = {
    // Sign up new user
    async signUp(userData) {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        full_name: userData.full_name,
                        phone_number: userData.phone_number,
                        role: userData.role || 'user'
                    }
                }
            })

            if (authError) throw authError

            if (authData.user) {
                const { error: dbError } = await supabase
                    .from('users')
                    .insert([{
                        id: authData.user.id,
                        full_name: userData.full_name,
                        email: userData.email,
                        password_hash: 'managed_by_auth',
                        phone_number: userData.phone_number,
                        country_code: userData.country_code,
                        role: userData.role || 'user'
                    }])

                if (dbError) throw dbError
            }

            return { success: true, data: authData }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Sign in user
    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            // Update last login
            if (data.user) {
                await supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', data.user.id)
            }

            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Sign out
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Get current user
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error) throw error

            if (user) {
                const { data: userData, error: dbError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (dbError) throw dbError
                return { success: true, data: userData }
            }

            return { success: true, data: null }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}

// Products Functions
export const products = {
    // Upload new product
    async createProduct(productData, images) {
        try {
            // Insert product
            const { data: product, error: productError } = await supabase
                .from('products')
                .insert([productData])
                .select()
                .single()

            if (productError) throw productError

            // Upload images to storage
            const imageUrls = []
            for (let i = 0; i < images.length; i++) {
                const file = images[i]
                const fileExt = file.name.split('.').pop()
                const fileName = `${product.id}/${Date.now()}-${i}.${fileExt}`
                const filePath = `product-images/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('products')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('products')
                    .getPublicUrl(filePath)

                imageUrls.push({
                    product_id: product.id,
                    image_url: publicUrl,
                    is_primary: i === 0
                })
            }

            // Insert image URLs
            if (imageUrls.length > 0) {
                const { error: imagesError } = await supabase
                    .from('product_images')
                    .insert(imageUrls)

                if (imagesError) throw imagesError
            }

            return { success: true, data: product }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Get all products
    async getProducts(filters = {}) {
        try {
            let query = supabase
                .from('products')
                .select(`
                    *,
                    product_images (*),
                    users!seller_id (
                        id,
                        full_name,
                        phone_number,
                        avatar_url
                    ),
                    product_categories (
                        categories (*)
                    ),
                    reviews (rating)
                `)
                .eq('status', 'available')
                .order('created_at', { ascending: false })

            // Apply filters
            if (filters.category) {
                query = query.contains('product_categories', [{ category_id: filters.category }])
            }

            if (filters.min_price) {
                query = query.gte('price', filters.min_price)
            }

            if (filters.max_price) {
                query = query.lte('price', filters.max_price)
            }

            if (filters.location) {
                query = query.ilike('location', `%${filters.location}%`)
            }

            const { data, error } = await query

            if (error) throw error

            // Calculate average rating
            const productsWithRating = data.map(product => {
                const ratings = product.reviews?.map(r => r.rating) || []
                const avgRating = ratings.length > 0 
                    ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
                    : 0
                return { ...product, average_rating: avgRating }
            })

            return { success: true, data: productsWithRating }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Search products
    async searchProducts(query) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    product_images (*),
                    users!seller_id (*)
                `)
                .eq('status', 'available')
                .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                .order('created_at', { ascending: false })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Get single product
    async getProduct(id) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    product_images (*),
                    users!seller_id (*),
                    reviews (
                        *,
                        users!reviewer_id (full_name, avatar_url)
                    )
                `)
                .eq('id', id)
                .single()

            if (error) throw error

            // Increment views
            await supabase
                .from('products')
                .update({ views_count: (data.views_count || 0) + 1 })
                .eq('id', id)

            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Update product
    async updateProduct(id, productData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .update(productData)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Delete product
    async deleteProduct(id) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id)

            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}

// Favorites Functions
export const favorites = {
    // Add to favorites
    async addFavorite(userId, productId) {
        try {
            const { error } = await supabase
                .from('favorites')
                .insert([{ user_id: userId, product_id: productId }])

            if (error) throw error

            // Increment favorites count
            await supabase.rpc('increment_favorites', { product_id: productId })

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Remove from favorites
    async removeFavorite(userId, productId) {
        try {
            const { error } = await supabase
                .from('favorites')
                .delete()
                .match({ user_id: userId, product_id: productId })

            if (error) throw error

            // Decrement favorites count
            await supabase.rpc('decrement_favorites', { product_id: productId })

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Get user favorites
    async getUserFavorites(userId) {
        try {
            const { data, error } = await supabase
                .from('favorites')
                .select(`
                    *,
                    products (
                        *,
                        product_images (*),
                        users!seller_id (*)
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}

// CHAT SYSTEM FUNCTIONS
export const chat = {
    // Create or get conversation
    async getOrCreateConversation(buyerId, sellerId, productId) {
        try {
            // Check if conversation exists
            const { data: existing, error: findError } = await supabase
                .from('conversations')
                .select('*')
                .eq('buyer_id', buyerId)
                .eq('seller_id', sellerId)
                .eq('product_id', productId)
                .single()

            if (findError && findError.code !== 'PGRST116') throw findError

            if (existing) {
                return { success: true, data: existing }
            }

            // Create new conversation
            const { data: newConversation, error: createError } = await supabase
                .from('conversations')
                .insert([{
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    product_id: productId,
                    buyer_unread_count: 0,
                    seller_unread_count: 0
                }])
                .select()
                .single()

            if (createError) throw createError

            return { success: true, data: newConversation }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Send message
    async sendMessage(conversationId, senderId, receiverId, message, imageFile = null) {
        try {
            let imageUrl = null

            // Upload image if exists
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop()
                const fileName = `chat/${conversationId}/${Date.now()}.${fileExt}`
                
                const { error: uploadError } = await supabase.storage
                    .from('chat-images')
                    .upload(fileName, imageFile)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('chat-images')
                    .getPublicUrl(fileName)

                imageUrl = publicUrl
            }

            // Insert message
            const { data: messageData, error: messageError } = await supabase
                .from('messages')
                .insert([{
                    conversation_id: conversationId,
                    sender_id: senderId,
                    receiver_id: receiverId,
                    message: message,
                    message_type: imageUrl ? 'image' : 'text',
                    image_url: imageUrl,
                    is_read: false
                }])
                .select(`
                    *,
                    users!sender_id (full_name, avatar_url)
                `)
                .single()

            if (messageError) throw messageError

            // Update conversation
            await supabase
                .from('conversations')
                .update({
                    last_message: message,
                    last_message_time: new Date().toISOString()
                })
                .eq('id', conversationId)

            // Increment unread count for receiver
            const { data: conversation } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', conversationId)
                .single()

            if (conversation) {
                const updateField = conversation.buyer_id === receiverId 
                    ? 'buyer_unread_count' 
                    : 'seller_unread_count'
                
                await supabase
                    .from('conversations')
                    .update({ [updateField]: supabase.sql`${updateField} + 1` })
                    .eq('id', conversationId)
            }

            // Create notification for receiver
            await supabase
                .from('notifications')
                .insert([{
                    user_id: receiverId,
                    type: 'new_message',
                    title: 'New Message',
                    message: `You have a new message`,
                    data: { conversation_id: conversationId, message_id: messageData.id }
                }])

            return { success: true, data: messageData }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Get conversation messages
    async getMessages(conversationId) {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    users!sender_id (full_name, avatar_url)
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Get user conversations
    async getUserConversations(userId) {
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    buyer:users!buyer_id (id, full_name, avatar_url, phone_number),
                    seller:users!seller_id (id, full_name, avatar_url, phone_number),
                    product:products (*, product_images (*)),
                    messages (*)
                `)
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
                .order('updated_at', { ascending: false })

            if (error) throw error

            // Mark messages as read
            data.forEach(async (conversation) => {
                const isBuyer = conversation.buyer_id === userId
                const unreadField = isBuyer ? 'buyer_unread_count' : 'seller_unread_count'
                
                if (conversation[unreadField] > 0) {
                    await supabase
                        .from('conversations')
                        .update({ [unreadField]: 0 })
                        .eq('id', conversation.id)

                    await supabase
                        .from('messages')
                        .update({ 
                            is_read: true, 
                            read_at: new Date().toISOString() 
                        })
                        .eq('conversation_id', conversation.id)
                        .eq('receiver_id', userId)
                        .eq('is_read', false)
                }
            })

            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Subscribe to new messages (Real-time)
    subscribeToMessages(conversationId, callback) {
        return supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    callback(payload.new)
                }
            )
            .subscribe()
    },

    // Subscribe to conversations
    subscribeToConversations(userId, callback) {
        return supabase
            .channel(`conversations:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations',
                    filter: `or(buyer_id.eq.${userId},seller_id.eq.${userId})`
                },
                (payload) => {
                    callback(payload)
                }
            )
            .subscribe()
    }
}

// Notifications Functions
export const notifications = {
    // Get user notifications
    async getUserNotifications(userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Mark notification as read
    async markAsRead(notificationId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ 
                    is_read: true, 
                    read_at: new Date().toISOString() 
                })
                .eq('id', notificationId)

            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Mark all as read
    async markAllAsRead(userId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ 
                    is_read: true, 
                    read_at: new Date().toISOString() 
                })
                .eq('user_id', userId)
                .eq('is_read', false)

            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    },

    // Subscribe to notifications
    subscribeToNotifications(userId, callback) {
        return supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    callback(payload.new)
                }
            )
            .subscribe()
    }
}