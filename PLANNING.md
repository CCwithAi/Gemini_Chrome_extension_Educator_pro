# PLANNING: Dockerizing the Extension Backend

This document outlines the plan to containerize the backend service for the Chrome/Edge extension using Docker Desktop on Windows. The goal is to run the backend locally in a container, so the frontend plug in can communicate keeping all functionality.

## 1. Prerequisites

* Docker Desktop for Windows installed and running (using the WSL 2 backend is recommended).
* Backend source code available locally.
* Basic understanding of Docker concepts (Dockerfile, image, container). Use websearch

## 2. Strategy

The core strategy involves creating a Docker image for the backend service and running it as a container, mapping a host so the backend listens on inside the container.

## 3. Key Stages

### 3.1. Create `Dockerfile`
* Define a `Dockerfile` in the root directory of your backend code.
* This file will specify the base image (e.g., `node`, `python`), copy necessary code, install dependencies, expose the required port, and define the command to start the backend server.

### 3.2. Create `.dockerignore`
* Create a `.dockerignore` file to exclude unnecessary files/folders (like `node_modules`, `.git`, logs, local configuration) from being copied into the Docker image, keeping the image size small and build times fast.

### 3.3. Configure Backend (If Necessary)
* **Listening Address:** Ensure the backend server inside the container listens on `0.0.0.0` rather than `127.0.0.1` or `localhost`. This allows it to accept connections from outside the container (specifically, from the Docker network).
* **CORS:** Configure the backend to handle Cross-Origin Resource Sharing (CORS). It must allow requests from your extension's origin (e.g., `chrome-extension://<your-extension-id>`).

### 3.4. Build Docker Image
* Use the `docker build` command to create a Docker image based on the `Dockerfile`.

### 3.5. Run Docker Container
* Use the `docker run` command to start a container from the built image.
* Crucially, map the desired host port (`8509`) to the port the backend application listens on *inside* the container (e.g., `-p 8509:3000` if the backend listens on port 3000).

### 3.6. Update Extension
* Modify the extension's frontend code (content scripts, background script, popup) to send requests to `http://localhost:8509` instead of its previous target.

### 3.7. Testing
* Launch the extension and verify it can successfully communicate with the backend running in the Docker container.
* Check container logs (`docker logs <container_id>`) for any backend errors.

## 4. Considerations
* **Port Conflicts:** Ensure port `8509` is not already in use on your host machine.
* **Environment Variables:** If your backend relies on environment variables, provide them to the container using the `-e` flag in `docker run` or a `.env` file with Docker Compose (optional).
* **Data Persistence:** If your backend needs to persist data (e.g., in a database), use Docker volumes to store data outside the container. (This plan focuses on stateless backends initially).
