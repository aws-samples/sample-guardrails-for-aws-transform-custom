# Multi-stage build for greeting-service.
#
# The repository exists in two states: the "before" tree on main builds on
# Java 8, and the transformed tree builds on Java 17. JAVA_VERSION selects
# the JDK for both stages, so the same Dockerfile builds either state:
#
#   docker build -t greeting-service .                          # before (Java 8)
#   docker build --build-arg JAVA_VERSION=17 -t greeting-service .   # after
ARG JAVA_VERSION=8

# ---- Stage 1: build with Maven ----
# Base images are pulled from Amazon ECR Public (a mirror of the Docker
# official images) rather than Docker Hub directly: pulls are anonymous and
# not subject to Docker Hub's unauthenticated rate limits.
FROM public.ecr.aws/docker/library/maven:3.8-eclipse-temurin-${JAVA_VERSION} AS build
WORKDIR /app

# Copy the pom first so dependency resolution is cached as its own layer.
# Source edits then re-run only the compile step, not the full download.
COPY pom.xml .
RUN mvn -q dependency:go-offline

COPY src ./src
RUN mvn -q package -DskipTests

# ---- Stage 2: slim runtime with only the JRE and the jar ----
FROM public.ecr.aws/docker/library/eclipse-temurin:${JAVA_VERSION}-jre
WORKDIR /app
COPY --from=build /app/target/greeting-service-1.0.0.jar app.jar

# Run as a non-root user: without this the JVM runs as root inside the
# container (flagged Critical by SAST scanners, and rightly so).
RUN groupadd --system app && useradd --system --gid app --no-create-home appuser
USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
