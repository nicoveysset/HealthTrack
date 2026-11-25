package com.healthtrack.ordonnances;

import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.AwsProxyResponse;
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequest;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;

/**
 * Handler AWS Lambda — déploie l'app Spring Boot sur Lambda + API Gateway (HTTP API v2).
 * Handler AWS à configurer : com.healthtrack.ordonnances.LambdaHandler
 * En local : mvn spring-boot:run -pl api-ordonnances
 */
public class LambdaHandler implements RequestHandler<HttpApiV2ProxyRequest, AwsProxyResponse> {

    private static final SpringBootLambdaContainerHandler<HttpApiV2ProxyRequest, AwsProxyResponse> handler;

    static {
        try {
            handler = SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(OrdonnancesApplication.class);
        } catch (ContainerInitializationException e) {
            throw new RuntimeException("Init Spring Boot impossible", e);
        }
    }

    @Override
    public AwsProxyResponse handleRequest(HttpApiV2ProxyRequest event, Context context) {
        return handler.proxy(event, context);
    }
}
