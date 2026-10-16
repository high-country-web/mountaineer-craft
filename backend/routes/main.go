package routes

import (
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var router = gin.Default()

// Run will start the server
func Run() {
	gin.SetMode(gin.ReleaseMode)
	router.SetTrustedProxies([]string{"127.0.0.1", "172.18.0.1"})

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://mountaineercraft.net", "http://localhost:3000"}, // your Next.js app URL
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true, // important to send cookies
		MaxAge:           12 * time.Hour,
	}))

	router.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{
			"error":   true,
			"message": "Route not found",
		})
	})

	getRoutes()

	port := os.Getenv("PORT")
	if port == "" {
		port = ":8080"
	} else if port[0] != ':' {
		port = ":" + port
	}

	log.Printf("Webserver listening on %s", port)

	if err := router.Run(port); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}

// getRoutes will create our routes of our entire application
// this way every group of routes can be defined in their own file
// so this one won't be so messy
func getRoutes() {
	main := router.Group("/")
	mainRoute(main)

	auth := router.Group("/auth")
	auth.POST("/discord", authRoute)
	auth.POST("/logout", RequireSession(), logoutRoute)

	me := router.Group("/me")
	meRoute(me)
}
