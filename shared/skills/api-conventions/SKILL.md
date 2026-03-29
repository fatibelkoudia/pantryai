---
name: api-conventions
description: |
  Activate for NestJS controller, service, DTO, or module work.
  Enforces PantryAI API conventions automatically.
---

# PantryAI API Conventions

## Endpoints: plural nouns (/products, /recipes, /stocks)

## Nested: /users/:userId/stocks

## Response wrapper: { success: boolean, data?: T, error?: { code, message }, meta?: { page, limit, total } }

## Errors: 400 validation, 401 auth, 403 forbidden, 404 not found, 422 business logic, 500 server

## Every endpoint: @ApiTags, @ApiOperation, @ApiResponse, @UseGuards(JwtAuthGuard)

## Every DTO: class-validator decorators (@IsString, @IsEmail, etc.)

## Prisma 7: driver adapter pattern, never raw SQL, transactions for multi-table
