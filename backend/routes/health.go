package routes

import (
	"backend/utils"
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func healthRoute(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second)
	defer cancel()
	if utils.Rdb == nil || utils.Rdb.Ping(ctx).Err() != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
