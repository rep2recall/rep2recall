package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime
import rep2recall.api.Api
import java.io.File
import java.net.URL
import java.nio.file.Files
import java.nio.file.Paths
import javax.imageio.ImageIO

object UserTable: InitTable("user") {
    val updatedAt = datetime("updated_at").nullable()

    val email = varchar("email", 100).uniqueIndex()
    val image = varchar("image", 100)
    val name = varchar("name", 100)
    val apiKey = varchar("api_key", 100)
}

class User(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<User>(UserTable) {
        override fun new(id: String?, init: User.() -> Unit): User {
            return super.new(id ?: ULID.random()) {
                apiKey = newApiKey()
                init()
            }
        }

        override fun new(init: User.() -> Unit) = new(null, init)

        fun create(
                email: String,
                name: String? = null,
                image: String? = null,
                id: String? = null
        ): User {
            var trueName = name ?: email.split('@')[0]
            val filename = let {
                val s = StringBuilder()
                for (c in email.toCharArray()) {
                    if (c == '.' || Character.isJavaIdentifierPart(c)) {
                        s.append(c)
                    }
                }

                if (s.isBlank()) {
                    "${randomString(16)}.png"
                } else "$s.png"
            }
            var imageURL = ""
            try {
                if (image != null) {
                    Files.copy(
                            URL(image).openStream(),
                            Paths.get(
                                    Db.mediaPath.toString(),
                                    filename
                            )
                    )
                    imageURL = "/media/$filename"
                }
            } catch (e: Error) {}

            if (imageURL.isEmpty()) {
                ImageIO.write(
                        email.avatar(),
                        "png",
                        Paths.get(
                                Db.mediaPath.toString(),
                                filename
                        ).toFile()

                )
                imageURL = "/media/$filename"
            }

            if (trueName.isEmpty()) {
                trueName = "default"
            }

            return new(id) {
                this.name = trueName
                this.email = email
                this.image = imageURL
            }
        }

        fun newApiKey() = randomString(32)
    }

    var updatedAt by UserTable.updatedAt

    var email by UserTable.email
    var image by UserTable.image
    var name by UserTable.name
    var apiKey by UserTable.apiKey

    val notes by Note referrersOn NoteTable.userId
    val presets by Preset referrersOn PresetTable.userId
    val tags by Tag referrersOn TagTable.userId

    override fun delete() {
        notes.map { it.delete() }
        presets.map { it.delete() }
        tags.map { it.delete() }
        super.delete()
    }

    override fun serialize() = UserSer(
            id.value,
            email, image, name, apiKey
    )
}

data class UserSer(
        val id: String,
        val email: String,
        val image: String?,
        val name: String,
        val apiKey: String
)

data class UserPartialSer(
        val id: String?,
        val email: String?,
        val image: String?,
        val name: String?,
        val apiKey: String?
)