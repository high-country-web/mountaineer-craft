package utils

import (
	ratelimit "github.com/JGLTechnologies/gin-rate-limit"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"net/http"
	"os"
	"time"
)

func errorHandler(c *gin.Context, info ratelimit.Info) {
	c.JSON(http.StatusTooManyRequests, gin.H{
		"error":   true,
		"message": "rate limit exceeded",
		"data":    info.ResetTime,
	})
}

func keyFunc(c *gin.Context) string {
	return c.ClientIP()
}

// NewRateLimiter creates a rate limiter gin handler by given rate and limit
// parameters with default error handler function.
func NewRateLimiter(rate time.Duration, limit uint) gin.HandlerFunc {

	store := ratelimit.RedisStore(&ratelimit.RedisOptions{
		RedisClient: redis.NewClient(&redis.Options{
			Addr:     os.Getenv("REDIS_HOST") + ":" + os.Getenv("REDIS_PORT"),
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       0,
		}),
		Rate:  rate,
		Limit: limit,
	})

	limiter := ratelimit.RateLimiter(store, &ratelimit.Options{
		ErrorHandler: errorHandler,
		KeyFunc:      keyFunc,
	})

	return limiter
}
