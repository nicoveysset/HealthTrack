package com.healthtrack.rdv.dto;

import java.util.List;

public record PagedResponse<T>(List<T> items, long count, int page, int limit) {}
