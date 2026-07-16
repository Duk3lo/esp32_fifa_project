package com.proyecto.fifa.config;

import jakarta.annotation.Nonnull;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.jmdns.JmDNS;
import javax.jmdns.ServiceInfo;
import java.net.InetAddress;

@Component
public class MdnsConfig {

    private JmDNS jmdns;

    @EventListener
    public void onWebServerReady(@Nonnull WebServerInitializedEvent event) {
        int port = event.getWebServer().getPort();
        try {
            InetAddress addr = InetAddress.getLocalHost();
            jmdns = JmDNS.create(addr, "fifa-backend");

            ServiceInfo serviceInfo = ServiceInfo.create(
                    "_http._tcp.local.",
                    "fifa-backend",
                    port,
                    "Backend FIFA 2026"
            );
            jmdns.registerService(serviceInfo);
            System.out.println("mDNS activo: fifa-backend.local -> puerto " + port);
        } catch (Exception e) {
            System.out.println("No se pudo iniciar mDNS: " + e.getMessage());
        }
    }

    @PreDestroy
    public void stop() {
        if (jmdns != null) {
            try {
                jmdns.unregisterAllServices();
                jmdns.close();
            } catch (Exception ignored) {}
        }
    }
}