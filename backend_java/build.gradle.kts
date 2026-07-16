plugins {
    id("java")
    id("org.springframework.boot") version "3.3.1"
    id("io.spring.dependency-management") version "1.1.5"
}

group = "com.proyecto.fifa"
version = "1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot Starters
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")

    // JmDNS
    implementation("org.jmdns:jmdns:3.5.9")

    // Driver de Base de Datos
    runtimeOnly("com.mysql:mysql-connector-j")

    // Lombok para ahorrar getters/setters
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // Anotaciones de JetBrains
    compileOnly("org.jetbrains:annotations:24.1.0")
}

tasks.withType<Test> {
    useJUnitPlatform()
}