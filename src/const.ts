export const getDockerFile = (nodeVersion: string) => {
  return `
    FROM node:${nodeVersion}

    RUN npm install pm2 -g

    EXPOSE 3000
    `;
};

export const getDockerComposeFile = (projectName: string) => {
  return `
    version: "3.9"
    services:
        admin:
            build:
                context: ./
                dockerfile: Dockerfile
            image: ${projectName}
            tty: true
            restart: unless-stopped
            container_name: ${projectName}
            working_dir: /app/
            volumes:
                - ./:/app
            ports:
                - "3000:3000"
            networks:
                - ${projectName}
    networks:
        ${projectName}:
            driver: bridge
    `;
};
export const getEcosystemConfigJsFile = (projectName: string) => {
  return `
    module.exports = {
        apps: [
          {
            name: "${projectName}-prod",
            script: "yarn",
            args: "start",
            interpreter: "/bin/bash",
            env: {
              NODE_ENV: "production",
            },
          },
          {
            name: "${projectName}-dev",
            script: "yarn",
            args: "dev",
            interpreter: "/bin/bash",
            watch: true,
          },
        ],
      };
    `;
};

export const getDeployShFile = (projectName: string) => {
  return `
    git pull
    docker-compose down
    docker-compose up -d
    docker exec ${projectName} yarn install
    docker exec ${projectName} yarn build
    docker exec ${projectName} pm2 start --only "${projectName}-prod"
    `;
};
