package com.healthtrack.utilisateurs.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClientBuilder;

import java.net.URI;

/**
 * Client DynamoDB. Sur Lambda, la région et les identifiants viennent de l'environnement d'exécution
 * (rôle IAM). En local, DYNAMODB_ENDPOINT permet de pointer vers DynamoDB Local (tests).
 */
@Configuration
public class DynamoDbConfig {
    @Bean
    public DynamoDbClient dynamoDbClient(@Value("${aws.region:us-east-1}") String region,
                                         @Value("${aws.dynamodb.endpoint:}") String endpoint) {
        DynamoDbClientBuilder builder = DynamoDbClient.builder().region(Region.of(region));
        if (endpoint != null && !endpoint.isBlank()) builder.endpointOverride(URI.create(endpoint));
        return builder.build();
    }

    @Bean
    public DynamoDbEnhancedClient dynamoDbEnhancedClient(DynamoDbClient client) {
        return DynamoDbEnhancedClient.builder().dynamoDbClient(client).build();
    }
}
