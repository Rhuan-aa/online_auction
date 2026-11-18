package br.edu.ifsp.leilao.corrida.config;

import com.zaxxer.hikari.HikariDataSource;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Um pool de conexões por arquitetura, para uma não roubar conexões da outra: a espera por
 * conexão entra na latência só da própria arquitetura. Não são beans DataSource de propósito
 * (o DataSource do Spring continua o padrão, usado no DDL).
 */
@Component
public class Conexoes implements DisposableBean {

    private final String url;
    private final String usuario;
    private final String senha;
    private final int tamanho;
    private final Map<String, HikariDataSource> pools = new ConcurrentHashMap<>();

    public Conexoes(@Value("${spring.datasource.url}") String url,
                    @Value("${spring.datasource.username}") String usuario,
                    @Value("${spring.datasource.password}") String senha,
                    @Value("${corrida.pool-por-arquitetura:8}") int tamanho) {
        this.url = url;
        this.usuario = usuario;
        this.senha = senha;
        this.tamanho = tamanho;
    }

    public JdbcClient para(String arquitetura) {
        return JdbcClient.create(pools.computeIfAbsent(arquitetura, id -> {
            HikariDataSource ds = new HikariDataSource();
            ds.setJdbcUrl(url);
            ds.setUsername(usuario);
            ds.setPassword(senha);
            ds.setMaximumPoolSize(tamanho);
            ds.setMinimumIdle(0);
            ds.setPoolName("corrida-" + id);
            return ds;
        }));
    }

    @Override
    public void destroy() {
        pools.values().forEach(HikariDataSource::close);
    }
}
