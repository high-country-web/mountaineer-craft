package utils

import (
	"context"
	"github.com/redis/go-redis/v9"
	"log"
	"os"
)

var Rdb *redis.Client

func ConnectToRedis() error {

	opts := redis.Options{
		Addr:     os.Getenv("REDIS_HOST") + ":" + os.Getenv("REDIS_PORT"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	}

	Rdb = redis.NewClient(&opts)
	_, err := Rdb.Ping(context.Background()).Result()
	if err != nil {
		return err
	} else {
		log.Println("Redis connection established")
	}

	return nil
}
