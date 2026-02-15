# Gunakan image Node.js yang ringan
FROM node:18-alpine

# Set working directory di dalam container
WORKDIR /app

# Copy package.json dan yarn.lock terlebih dahulu agar bisa cache dependencies
COPY package.json yarn.lock ./

# Install dependencies menggunakan yarn
# --frozen-lockfile memastikan versi yang sama dengan yarn.lock
RUN yarn install --frozen-lockfile

# Copy seluruh source code ke dalam container
COPY . .

# Expose port yang digunakan aplikasi
EXPOSE 3000

# Command untuk menjalankan aplikasi
CMD ["yarn", "start"]
