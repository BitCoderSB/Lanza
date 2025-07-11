# frontend/Dockerfile

# Etapa 1: Construir la aplicación React
FROM node:18-alpine AS build

WORKDIR /app

# Eliminamos ARG y ENV de aquí, ya no son necesarios
# ARG VITE_BACKEND_URL
# ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Copia package.json desde la carpeta 'frontend'
COPY frontend/package.json ./frontend/

# Moverse al directorio de trabajo del frontend
WORKDIR /app/frontend

# Instala las dependencias
RUN npm install

# Copia el resto del código del frontend
COPY frontend/. .

# --- CAMBIO CRÍTICO AQUÍ ---
# Pasamos VITE_BACKEND_URL directamente como variable de entorno al comando npx vite build
# Render inyecta VITE_BACKEND_URL al entorno del contenedor, y este comando la usará.
RUN VITE_BACKEND_URL=${VITE_BACKEND_URL} npx vite build
# --- FIN CAMBIO ---


# Etapa 2: Servir la aplicación construida
FROM node:18-alpine

WORKDIR /app

# Instala 'serve' globalmente
RUN npm install -g serve

# Copia los archivos construidos de la etapa 'build'
COPY --from=build /app/frontend/dist ./dist

# Expone el puerto donde 'serve' escuchará
EXPOSE 3000

# Comando para iniciar el servidor 'serve'
CMD ["serve", "-s", "dist", "-l", "3000"]