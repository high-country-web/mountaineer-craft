package main

import (
	"backend/routes"
	"backend/utils"
	"log"
	"os"

	"github.com/joho/godotenv"
)

func init() {
	if err := godotenv.Load(".env"); err != nil && !os.IsNotExist(err) {
		log.Println("Error loading .env file")
	}
}

func main() {
	log.Println("Starting Mountaineer Craft API")
	// start redis
	err := utils.ConnectToRedis()
	if err != nil {
		log.Fatal(err)
	}
	routes.Run()
}
